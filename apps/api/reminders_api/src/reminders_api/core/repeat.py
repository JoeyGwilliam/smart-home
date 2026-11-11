import calendar
from datetime import datetime, timedelta
from enum import StrEnum


class Repeat(StrEnum):
    """ How often a repeating reminder comes round again. """

    DAILY = "daily"
    WEEKLY = "weekly"
    FORTNIGHTLY = "fortnightly"
    MONTHLY = "monthly"
    YEARLY = "yearly"

    def advance(self, moment: datetime, count: int) -> datetime:
        """ Finds the moment that is a number of repeats after another, at the same time of day on the clock.

        Keeping the clock time means that something due at 09:00 stays due at 09:00 when the clocks change, as long as
        the moment is in the time zone whose clocks it should follow.

        Args:
            moment:
                The moment to start from.
            count:
                How many repeats to move forward by. Must not be negative.

        Returns:
            The later moment, in the same time zone. A monthly or yearly repeat that lands on a day the month doesn't
            have, such as the 31st of a shorter month, moves back to that month's last day.
        """
        match self:
            case Repeat.DAILY:
                return moment + timedelta(days=count)
            case Repeat.WEEKLY:
                return moment + timedelta(weeks=count)
            case Repeat.FORTNIGHTLY:
                return moment + timedelta(weeks=2 * count)
            case Repeat.MONTHLY:
                return _add_months(moment, count)
            case Repeat.YEARLY:
                return _add_months(moment, 12 * count)


def _add_months(moment: datetime, month_count: int) -> datetime:
    year, month_index = divmod(moment.month - 1 + month_count, 12)
    year += moment.year
    month = month_index + 1
    day = min(moment.day, calendar.monthrange(year, month)[1])
    return moment.replace(year=year, month=month, day=day)
