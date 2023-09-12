import {
  NetworkRequest,
  NetworkRequestConfig,
  NetworkResponse,
} from "@suwatte/daisuke";
import axios from "axios";
let globalObject = global as any;

// STORE
class GlobalStore {
  secure: Record<string, string> = {};
  objects: Record<string, string> = {};
}

const globalStore = new GlobalStore();
// Object Store
class STTStore {
  private readonly store: string;
  constructor(key: string) {
    this.store = key;
  }

  async get(key: string) {
    const value =
      this.store == "ss" ? globalStore.secure[key] : globalStore.objects[key];
    return value ? JSON.parse(value) : null;
  }
  async set(key: string, value: any) {
    const v = JSON.stringify(value);
    this.store == "ss"
      ? (globalStore.secure[key] = v)
      : (globalStore.objects[key] = v);
  }
  async remove(key: string) {
    if (this.store == "ss") delete globalStore.secure[key];
    else delete globalStore.objects[key];
  }

  async string(key: string) {
    const value = await this.get(key);
    if (!value) return null;

    if (typeof value !== "string")
      throw new Error(
        "ObjectStore Type Assertion failed, value is not a string"
      );
    return value;
  }
  async boolean(key: string) {
    const value = await this.get(key);
    if (!value) return null;

    if (typeof value !== "boolean")
      throw new Error(
        "ObjectStore Type Assertion failed, value is not a boolean"
      );
    return value;
  }
  async number(key: string) {
    const value = await this.get(key);
    if (!value) return null;

    if (typeof value !== "number")
      throw new Error(
        "ObjectStore Type Assertion failed, value is not a number"
      );
    return value;
  }

  async stringArray(key: string): Promise<string[] | null> {
    const value = await this.get(key);
    if (!value) return null;

    if (typeof value !== "object" || !Array.isArray(value))
      throw new Error(
        "ObjectStore type assertion failed, value is not an array"
      );

    if (!value?.[0]) return value; // Return If Empty

    const isValid = value.every((v) => typeof v === "string");
    if (!isValid)
      throw new Error(
        `ObjectStore Type Assertion Failed, Elements of Array are not of type string`
      );
    return value;
  }
}

// ERROR
class NetworkError extends Error {
  req: NetworkRequest;
  res: NetworkResponse;
  constructor(
    name: string,
    message: string,
    req: NetworkRequest,
    res: NetworkResponse
  ) {
    super(message);
    this.req = req;
    this.res = res;
    this.name = name;
  }
}

class CloudflareError extends Error {
  constructor() {
    super("The requested resource is cloudflare protected");
    this.name = "CloudflareError";
  }
}

// NETWORK CLIENT
type Transformer<T> = (v: T) => Promise<T>;
type NetworkRequestTransformer = Transformer<NetworkRequest>;
type NetworkResponseTransformer = Transformer<NetworkResponse>;
class NetworkClient {
  transformRequest?: NetworkRequestTransformer | NetworkRequestTransformer[];
  transformResponse?: NetworkResponseTransformer | NetworkResponseTransformer[];
  async get(url: string, config: NetworkRequestConfig) {
    return this.request({ url, method: "GET", ...config });
  }
  async post(url: string, config: NetworkRequestConfig) {
    return this.request({ url, method: "POST", ...config });
  }
  async request(request: NetworkRequest) {
    const factory = async <T>(r: any, methods: Transformer<T>[]) => {
      for (const m of methods) {
        r = await m(r);
      }
      return r;
    };

    //  Request Transform
    const reqTransformers: NetworkRequestTransformer[] = [];
    if (this.transformRequest) {
      if (typeof this.transformRequest === "function")
        reqTransformers.push(this.transformRequest);
      else reqTransformers.push(...this.transformRequest);
    }

    if (request.transformRequest) {
      if (typeof request.transformRequest === "function")
        reqTransformers.push(request.transformRequest);
      else reqTransformers.push(...request.transformRequest);
    }

    // Response Transform
    const resTransformers: NetworkResponseTransformer[] = [];
    if (this.transformResponse) {
      if (typeof this.transformResponse === "function")
        resTransformers.push(this.transformResponse);
      else resTransformers.push(...this.transformResponse);
    }

    if (request.transformResponse) {
      if (typeof request.transformResponse === "function")
        resTransformers.push(request.transformResponse);
      else resTransformers.push(...request.transformResponse);
    }

    // Run Request Transformers
    request = await factory(request, reqTransformers);

    // Dispatch
    const cookies = request.cookies
      ?.map((v) => `${v.name}=${v.value}`)
      .join("; ");
    const axiosResponse = await axios({
      method: request.method,
      params: request.params,
      url: request.url,
      headers: {
        ...request.headers,
        Cookie: cookies ?? "",
      },
      data: request.body,
    });
    let response: NetworkResponse = {
      headers: axiosResponse.headers,
      status: axiosResponse.status,
      data:
        typeof axiosResponse.data === "string"
          ? axiosResponse.data
          : JSON.stringify(axiosResponse.data),
      request: axiosResponse.request,
    };
    // Run Response Transformers
    response = await factory(response, resTransformers);

    // Validate Status
    const defaultValidateStatus = (s: number) => s >= 200 && s < 300;
    const validateStatus = request.validateStatus ?? defaultValidateStatus;

    if (!validateStatus(response.status)) {
      if (
        [503, 403].includes(response.status) &&
        response.headers["Server"] === "cloudflare"
      )
        throw new CloudflareError();

      const error = new NetworkError(
        "NetworkError",
        `Request failed with status ${response.status}`,
        request,
        response
      );
      switch (response.status) {
        case 400:
          error.message = "Bad Request";
          break;
        case 401:
          error.message = "Unauthorized";
          break;
        case 403:
          error.message = "Forbidden";
          break;
        case 404:
          error.message =
            "Not Found.\nThe server cannot find the requested resource.";
          break;
        case 405:
          error.message =
            "Method Not Allowed\nThe request method is known by the server but is not supported by the target resource.";
          break;
        case 410:
          error.message = "Gone.";
          break;
        case 429:
          error.message = "Too Many Requests.";
          break;
        case 431:
          error.message =
            "Request Header Fields Too Large.\nThe server is unwilling to process the request because its header fields are too large. ";
          break;
        case 500:
          error.message =
            "Internal Server Error.\nThe server has encountered a situation it does not know how to handle.";
          break;
        case 501:
          error.message =
            "Not Implemented\nThe request method is not supported by the server and cannot be handled.";
          break;
        case 502:
          error.message =
            "Bad Gateway\nThis error response means that the server, while working as a gateway to get a response needed to handle the request, got an invalid response.";
          break;
        case 503:
          error.message =
            "Service Unavailable.The server is not ready to handle the request. Common causes are a server that is down for maintenance or that is overloaded.";
          break;
        case 504:
          error.message =
            "Gateway Timeout\nThis error response is given when the server is acting as a gateway and cannot get a response in time.";
          break;
      }

      throw error;
    }

    return {
      ...response,
      request: request,
    };
  }
}
// Globals
globalObject.ObjectStore = new STTStore("os");
globalObject.SecureStore = new STTStore("ss");
globalObject.NetworkClient = NetworkClient;
globalObject.CloudflareError = CloudflareError;
globalObject.NetworkError = NetworkError;
