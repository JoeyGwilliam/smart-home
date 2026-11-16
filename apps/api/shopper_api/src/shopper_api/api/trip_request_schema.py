from pydantic import BaseModel, ConfigDict, Field

from shopper_api.core.claude_settings import ClaudeEffort, ClaudeModel, ClaudeSettings

# Long enough for any list of likes and dislikes, and short enough that it can't crowd out the shopping list. The
# page allows the same.
_MAXIMUM_PREFERENCES_LENGTH = 2000


class TripRequestSchema(BaseModel):
    """ The JSON representation of a request to fill the Morrisons trolley from the shopping list.

    Attributes:
        model:
            The model that should do the shopping.
        effort:
            How hard the model should think.
        preferences:
            How the household likes to shop, in its own words, for Claude to follow when choosing products. Empty if
            it has none.
    """
    model_config = ConfigDict(extra="forbid")

    model: ClaudeModel = ClaudeModel.SONNET
    effort: ClaudeEffort = ClaudeEffort.MEDIUM
    preferences: str = Field(default="", max_length=_MAXIMUM_PREFERENCES_LENGTH)

    def to_claude_settings(self) -> ClaudeSettings:
        """ Gathers how Claude should shop.

        Returns:
            The settings.
        """
        return ClaudeSettings(model=self.model, effort=self.effort, preferences=self.preferences.strip())
