import {
  NetworkRequest,
  NetworkRequestConfig,
  NetworkResponse,
} from "@suwatte/daisuke";
import axios from "axios";
let globalObject = global as any;

// Object Store
class ObjectStore {
  private store: Record<string, unknown> = {};
  async get(k: string): Promise<unknown | null> {
    return this.store[k] ?? null;
  }
  async set(k: string, v: string): Promise<void> {
    this.store[k] = v;
  }

  async remove(k: string): Promise<void> {
    delete this.store[k];
  }
}

// Secure Store
class SecureStore {
  private store: Record<string, unknown> = {};

  async get(k: string): Promise<unknown | null> {
    return this.store[k] ?? null;
  }
  async set(k: string, v: string): Promise<void> {
    this.store[k] = v;
  }
  async remove(k: string): Promise<void> {
    delete this.store[k];
  }
}

// NetworkClient
class NetworkClient {
  async get(
    url: string,
    config: NetworkRequestConfig
  ): Promise<NetworkResponse> {
    return this.request({ ...config, url });
  }
  async post(
    url: string,
    config: NetworkRequestConfig
  ): Promise<NetworkResponse> {
    return this.request({ ...config, url, method: "POST" });
  }
  async request(req: NetworkRequest): Promise<NetworkResponse> {
    if (this.requestInterceptHandler) {
      req = await this.requestInterceptHandler(req);
    }
    const cookies = req.cookies?.map((v) => `${v.name}=${v.value}`).join("; ");
    const axiosResponse = await axios({
      method: req.method,
      params: req.params,
      url: req.url,
      headers: {
        ...req.headers,
        Cookie: cookies ?? "",
      },
      data: req.body,
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

    if (this.responseInterceptHandler) {
      response = await this.responseInterceptHandler(response);
    }
    return response;
  }
  requestInterceptHandler?: (req: NetworkRequest) => Promise<NetworkRequest>;
  responseInterceptHandler?: (res: NetworkResponse) => Promise<NetworkResponse>;
}

// Globals
globalObject.ObjectStore = ObjectStore;
globalObject.SecureStore = SecureStore;
globalObject.NetworkClient = NetworkClient;
