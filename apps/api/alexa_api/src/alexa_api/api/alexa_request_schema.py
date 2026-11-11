from pydantic import AwareDatetime, BaseModel, Field

from alexa_api.core.skill_request import SkillRequest


class _SlotSchema(BaseModel):
    value: str | None = None


class _IntentSchema(BaseModel):
    name: str
    slots: dict[str, _SlotSchema] | None = None


class _RequestSchema(BaseModel):
    type: str
    timestamp: AwareDatetime
    intent: _IntentSchema | None = None


class _SessionSchema(BaseModel):
    attributes: dict[str, str] | None = None


class AlexaRequestSchema(BaseModel):
    """ The parts of the JSON that Alexa sends to a skill that this skill uses. Everything else is ignored.

    Attributes:
        request:
            What happened: its type, when, and for something a person said, the intent and slots that Alexa matched.
        session:
            The conversation that the request is part of, which carries what the skill asked to be remembered.
    """

    request: _RequestSchema
    session: _SessionSchema = Field(default_factory=_SessionSchema)

    def to_skill_request(self) -> SkillRequest:
        """ Converts this representation to a skill request.

        Returns:
            The skill request, named after the intent if there is one, and after the request type otherwise.
        """
        intent = self.request.intent
        slots = {} if intent is None else intent.slots or {}
        return SkillRequest(
            name=self.request.type if intent is None else intent.name,
            received_at=self.request.timestamp,
            slots={name: slot.value for name, slot in slots.items() if slot.value is not None},
            conversation_memory=self.session.attributes or {},
        )
