from dataclasses import asdict
from typing import Self

from pydantic import BaseModel, ConfigDict, model_validator

from pixel_art_api.core.picture import Picture, PictureFrame, PictureVariant


class PictureFrameSchema(BaseModel):
    """ The JSON representation of one frame of a variant (see PictureFrame, which owns the rules). """
    model_config = ConfigDict(extra="forbid", json_schema_serialization_defaults_required=True)

    rows: list[str]
    milliseconds: int = 200


class PictureVariantSchema(BaseModel):
    """ The JSON representation of one way a picture can look (see PictureVariant, which owns the rules). """
    model_config = ConfigDict(extra="forbid")

    name: str
    palette: dict[str, str]
    frames: list[PictureFrameSchema]


class PictureSchema(BaseModel):
    """ The JSON representation of a picture, used for both requests and responses.

    Attributes:
        variants:
            The ways the picture can look, each a strip of frames. The first is the one shown by default.
        title:
            What a new picture of one's own is, or null for a redrawing of one of the site's own pictures.
    """
    model_config = ConfigDict(extra="forbid", json_schema_serialization_defaults_required=True)

    variants: list[PictureVariantSchema]
    title: str | None = None

    @model_validator(mode="after")
    def _apply_picture_rules(self) -> Self:
        # Picture and the classes it is made of own the rules for a valid picture. A ValueError raised here becomes a
        # 422 response.
        self.to_picture()
        return self

    @classmethod
    def from_picture(cls, picture: Picture) -> Self:
        """ Creates the JSON representation of a picture. """
        return cls.model_validate(asdict(picture))

    def to_picture(self) -> Picture:
        """ Converts this representation to a picture. """
        variants = tuple(
            PictureVariant(
                name=variant.name,
                palette=variant.palette,
                frames=tuple(PictureFrame(rows=tuple(frame.rows), milliseconds=frame.milliseconds) for frame in variant.frames),
            )
            for variant in self.variants
        )
        return Picture(variants=variants, title=self.title)
