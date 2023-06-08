import { Router } from "$/deps.ts";
import { Singleton } from "$/lib/inject.ts";
import { BackgroundTaskService } from "$/services/BackgroundTaskService.ts";
import {
  DispatchOptions,
  HttpDispatcher,
  responseOrThrow,
} from "$/services/HttpDispatcher.ts";
import { MockHttpClientService } from "$/test/mock/MockHttpClientService.ts";

@Singleton()
export class MockHttpDispatcher extends HttpDispatcher {
  constructor(
    backgroundTaskService: BackgroundTaskService = new BackgroundTaskService(),
    private readonly client: MockHttpClientService =
      new MockHttpClientService(),
  ) {
    super(backgroundTaskService);
  }

  route(host: string, router: Router): void {
    this.client.route(host, router);
  }

  dispatchAndWait(
    request: Request,
    {
      throwOnError,
      errorMessage,
    }: DispatchOptions,
  ): Promise<Response> {
    const response = this.client.fetch(request);
    return throwOnError
      ? responseOrThrow(response, request.url, throwOnError, errorMessage)
      : response;
  }

  cancelAllForDomain() {/* does nothing */}
}
