import { view } from "$/lib/html.ts";
import { sprintf } from "$/deps.ts";
import { DateTime, datetime } from "$/lib/datetime/mod.ts";

const SECOND = 1000,
  MINUTE = 60 * SECOND,
  HOUR = 60 * MINUTE,
  DAY = 24 * HOUR,
  WEEK = 7 * DAY;

interface Props {
  date: DateTime;
  titleFormat?: string;
}

export const RelativeDateTime = view<Props>(
  ({ date, titleFormat }, { dateTime, relativeTime, strings: { justNow } }) => {
    const now = datetime(),
      diff = date.toMilliseconds() - now.toMilliseconds(),
      absDiff = Math.abs(diff);
    let shortTime: string;
    if (absDiff < SECOND) {
      shortTime = justNow;
    } else if (absDiff < MINUTE) {
      shortTime = relativeTime.format((diff / SECOND) | 0, "second");
    } else if (absDiff < HOUR) {
      shortTime = relativeTime.format((diff / MINUTE) | 0, "minute");
    } else if (absDiff < DAY) {
      shortTime = relativeTime.format((diff / HOUR) | 0, "hour");
    } else if (absDiff < WEEK) {
      shortTime = relativeTime.format((diff / DAY) | 0, "day");
    } else if (date.year !== now.year) {
      shortTime = relativeTime.format(date.year - now.year, "year");
    } else if (date.month !== now.month) {
      shortTime = relativeTime.format(date.month - now.month, "month");
    } else {
      shortTime = relativeTime.format((diff / WEEK) | 0, "week");
    }
    return (
      <time
        datetime={date.toISO()}
        title={titleFormat
          ? sprintf(titleFormat, dateTime.format(date.toJSDate()))
          : dateTime.format(date.toJSDate())}
      >
        {shortTime}
      </time>
    );
  },
);
