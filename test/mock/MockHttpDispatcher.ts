import { Router } from "$/deps.ts";
import { BackgroundTaskService } from "$/services/BackgroundTaskService.ts";
import {
  DispatchOptions,
  HttpDispatcher,
  responseOrThrow,
} from "$/services/HttpDispatcher.ts";
import { MockHttpClientService } from "$/test/mock/MockHttpClientService.ts";

export class MockHttpDispatcher extends HttpDispatcher {
  #client = new MockHttpClientService();

  constructor(backgroundTaskService: BackgroundTaskService) {
    super(backgroundTaskService);
  }

  route(host: string, router: Router): void {
    this.#client.route(host, router);
  }

  dispatchAndWait(
    request: Request,
    {
      throwOnError,
      errorMessage,
    }: DispatchOptions,
  ): Promise<Response> {
    const response = this.#client.fetch(request);
    return throwOnError
      ? responseOrThrow(response, request.url, throwOnError, errorMessage)
      : response;
  }

  cancelAllForDomain() {/* does nothing */}
}
