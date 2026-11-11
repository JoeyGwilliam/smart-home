from typing import Self
from uuid import UUID, uuid7

from pydantic import BaseModel, ConfigDict, Field, model_validator

from timers_api.api.timer_plan_schema import TimerPlanSchema
from timers_api.core.timer_preset import TimerPreset


class TimerPresetSchema(BaseModel):
    """ The JSON representation of a timer preset, used for both requests and responses.

    Attributes:
        plan:
            The saved plan. It and each of its tasks must have a name that contains non-whitespace text.
        id:
            Unique identifier that stays the same when the preset is edited. Ignored in a request, so that clients
            can send back a preset that they received.
    """
    model_config = ConfigDict(extra="forbid", json_schema_serialization_defaults_required=True)

    plan: TimerPlanSchema
    id: UUID = Field(default_factory=uuid7)

    @model_validator(mode="after")
    def _apply_preset_rules(self) -> Self:
        # TimerPreset owns the rules for a valid preset. A ValueError raised here becomes a 422 response.
        self.to_preset(self.id)
        return self

    @classmethod
    def from_preset(cls, preset: TimerPreset) -> Self:
        """ Creates the JSON representation of a timer preset.

        Args:
            preset:
                The preset to represent.

        Returns:
            The representation, with the preset's id.
        """
        return cls(plan=TimerPlanSchema.from_plan(preset.plan), id=preset.id)

    def to_preset(self, preset_id: UUID) -> TimerPreset:
        """ Converts this representation to a timer preset.

        Args:
            preset_id:
                The id of the new preset, which replaces any id in this representation.

        Returns:
            The preset.
        """
        return TimerPreset(plan=self.plan.to_plan(), id=preset_id)
