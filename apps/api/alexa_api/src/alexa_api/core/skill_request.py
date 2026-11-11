from dataclasses import dataclass, field
from datetime import datetime


@dataclass(frozen=True)
class SkillRequest:
    """ One thing that a person said to the skill, as Alexa understood it.

    Attributes:
        name:
            What the person wants. For something they said, this is the name of the matching intent in the skill's
            interaction model, such as `AddReminderIntent`. Otherwise it is Alexa's name for what happened:
            `LaunchRequest` when the skill is opened without saying what to do, and `SessionEndedRequest` when the
            conversation ends without the skill ending it.
        received_at:
            Timezone-aware moment that the person spoke.
        slots:
            The details that Alexa picked out of what was said, by slot name. Slots that weren't said are left out.
        conversation_memory:
            What the skill's previous reply in this conversation asked to be remembered. Empty at the start of a
            conversation.
    """

    name: str
    received_at: datetime
    slots: dict[str, str] = field(default_factory=dict)
    conversation_memory: dict[str, str] = field(default_factory=dict)
