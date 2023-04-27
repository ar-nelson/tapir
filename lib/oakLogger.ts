// Based on oak_logger: https://deno.land/x/oak_logger
import { Context, log } from "$/deps.ts";
import { format } from "datetime";

const X_RESPONSE_TIME = "X-Response-Time";
const User_Agent = "User-Agent";

/** The standard logging function that processes and logs requests. */
const logger = async (
  { request, response }: Context,
  next: () => Promise<unknown>,
) => {
  await next();
  const responseTime = response.headers.get(X_RESPONSE_TIME);
  const User = request.headers.get(User_Agent);
  const status: number = response.status;
  const logString = `[${
    format(new Date(Date.now()), "MM-dd-yyyy hh:mm:ss.SSS")
  }] ${request.ip} "${request.method} ${request.url.pathname}" ${
    String(status)
  } ${User} ${responseTime}`;
  if (status >= 500) log.error(logString);
  else if (status >= 400) log.warning(logString);
  else log.info(logString);
};

/** Response time calculator that also adds response time header. */
const responseTime = async (
  { response }: Context,
  next: () => Promise<unknown>,
) => {
  const start = Date.now();
  await next();
  const ms: number = Date.now() - start;
  response.headers.set(X_RESPONSE_TIME, `${ms}ms`);
};

export { logger, responseTime };
