from pydantic import BaseModel, ConfigDict

from shopper_api.core.claude_settings import ClaudeEffort, ClaudeModel, ClaudeSettings


class TripRequestSchema(BaseModel):
    """ The JSON representation of a request to fill the Morrisons trolley from the shopping list.

    Attributes:
        model:
            The model that should do the shopping.
        effort:
            How hard the model should think.
    """
    model_config = ConfigDict(extra="forbid")

    model: ClaudeModel = ClaudeModel.SONNET
    effort: ClaudeEffort = ClaudeEffort.MEDIUM

    def to_claude_settings(self) -> ClaudeSettings:
        """ Gathers how Claude should shop.

        Returns:
            The settings.
        """
        return ClaudeSettings(model=self.model, effort=self.effort)
