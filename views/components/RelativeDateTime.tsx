import { view } from "$/lib/html.ts";
import { sprintf } from "$/deps.ts";

const SECOND = 1000,
  MINUTE = 60 * SECOND,
  HOUR = 60 * MINUTE,
  DAY = 24 * HOUR,
  WEEK = 7 * DAY;

interface Props {
  date: Date;
  titleFormat?: string;
}

export const RelativeDateTime = view<Props>(
  ({ date, titleFormat }, { dateTime, relativeTime, strings: { justNow } }) => {
    const now = new Date(),
      diff = date.valueOf() - now.valueOf(),
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
    } else if (date.getUTCFullYear() !== now.getUTCFullYear()) {
      shortTime = relativeTime.format(
        date.getUTCFullYear() - now.getUTCFullYear(),
        "year",
      );
    } else if (date.getUTCMonth() !== now.getUTCMonth()) {
      shortTime = relativeTime.format(
        date.getUTCMonth() - now.getUTCMonth(),
        "month",
      );
    } else {
      shortTime = relativeTime.format((diff / WEEK) | 0, "week");
    }
    return (
      <time
        datetime={date.toJSON()}
        title={titleFormat
          ? sprintf(titleFormat, dateTime.format(date))
          : dateTime.format(date)}
      >
        {shortTime}
      </time>
    );
  },
);
