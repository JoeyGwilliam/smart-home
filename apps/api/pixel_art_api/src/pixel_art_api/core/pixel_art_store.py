from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import UUID, uuid7

from sqlalchemy import JSON, URL, DateTime, create_engine, delete, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker
from sqlalchemy.pool import NullPool

from .picture import Picture, PictureFrame, PictureVariant
from .preset import Preset
from .layer_design import LayerDesign
from .scene_design import SceneDesign
from .scene_placement import ScenePlacement

# The kinds of thing that make up the design, which are kept in the same way.
_PICTURE = "picture"
_SCENE = "scene"
_LAYER = "layer"

# The preset that a new database starts with, which holds nothing, so that putting it back shows everything as the site
# makes it. It is otherwise like any other preset: it can be renamed, saved over or deleted.
SITE_PRESET_NAME = "The site's own design"
_SITE_PRESET_MARKER = "site-preset-added"


class PixelArtStore:
    """ The home's pixel art, kept in a SQLite database, which every screen shares: the design that the backdrop shows
    now, and the presets saved from it.

    The design is every picture, layer and scene that has been saved, each under an id. The store doesn't know which
    of them the site has of its own, or how it draws them: that is the site's business, so anything can be kept under
    any id, and whatever isn't kept here is shown as the site makes it.
    """

    def __init__(self, database_path: Path) -> None:
        """ Connects to a pixel art database, creating the file and its tables if they don't exist. The first time the
        store opens a database, it adds a preset called SITE_PRESET_NAME, which holds an empty design.

        Args:
            database_path:
                Location of the SQLite database file. Its directory must exist.

        Raises:
            sqlalchemy.exc.OperationalError: If the database file cannot be opened.
        """
        url = URL.create("sqlite", database=str(database_path))
        engine = create_engine(url, poolclass=NullPool)
        _PixelArtDBBase.metadata.create_all(engine)

        self._begin_session = sessionmaker(engine).begin
        # Marked as added, so that the preset isn't added again once it has been deleted. Databases made before there was
        # such a preset get it too, the first time they are opened.
        with self._begin_session() as session:
            if session.get(_MarkerRow, _SITE_PRESET_MARKER) is None:
                session.add(_PresetRow.create(SITE_PRESET_NAME, design=[]))
                session.add(_MarkerRow(name=_SITE_PRESET_MARKER))

    def save_picture(self, picture_id: str, picture: Picture) -> None:
        """ Keeps a picture, replacing any picture already kept under its id.

        Args:
            picture_id:
                The id of one of the site's pictures to redraw, or an id for a picture of one's own.
            picture:
                The picture to keep.
        """
        self._save(_PICTURE, picture_id, asdict(picture))

    def list_pictures(self) -> dict[str, Picture]:
        """ Gives every picture that is kept.

        Returns:
            Each picture, keyed by its id.
        """
        return {picture_id: _convert_fields_to_picture(fields) for picture_id, fields in self._list(_PICTURE).items()}

    def delete_picture(self, picture_id: str) -> None:
        """ Ensures that no picture is kept under an id, so that the site shows its own picture again, or a picture of
        one's own is gone. Does nothing if there is no such picture.

        Args:
            picture_id:
                The id of the picture to delete.
        """
        self._delete(_PICTURE, picture_id)

    def save_scene(self, scene_id: str, scene: SceneDesign) -> None:
        """ Keeps a scene, replacing any scene already kept under its id.

        Args:
            scene_id:
                The id of one of the site's scenes to replace, such as "day-rain", or an id for a scene of one's own.
            scene:
                The scene to keep.
        """
        self._save(_SCENE, scene_id, asdict(scene))

    def list_scenes(self) -> dict[str, SceneDesign]:
        """ Gives every scene that is kept.

        Returns:
            Each scene, keyed by its id.
        """
        return {scene_id: _convert_fields_to_scene(fields) for scene_id, fields in self._list(_SCENE).items()}

    def delete_scene(self, scene_id: str) -> None:
        """ Ensures that no scene is kept under an id. Does nothing if there is no such scene.

        Args:
            scene_id:
                The id of the scene to delete.
        """
        self._delete(_SCENE, scene_id)

    def save_layer(self, layer_id: str, layer: LayerDesign) -> None:
        """ Keeps a layer, replacing any layer already kept under its id.

        Args:
            layer_id:
                The id of one of the site's layers to replace, such as "rain", or an id for a layer of one's own.
            layer:
                The layer to keep.
        """
        self._save(_LAYER, layer_id, asdict(layer))

    def list_layers(self) -> dict[str, LayerDesign]:
        """ Gives every layer that is kept.

        Returns:
            Each layer, keyed by its id.
        """
        return {layer_id: _convert_fields_to_layer(fields) for layer_id, fields in self._list(_LAYER).items()}

    def delete_layer(self, layer_id: str) -> None:
        """ Ensures that no layer is kept under an id. Does nothing if there is no such layer.

        Args:
            layer_id:
                The id of the layer to delete.
        """
        self._delete(_LAYER, layer_id)

    def save_preset(self, name: str) -> Preset:
        """ Saves a copy of the whole design, every picture, layer and scene, as it is now, as a new preset.

        Args:
            name:
                What to call the preset. Must contain non-whitespace text, and be at most 80 characters.

        Returns:
            The new preset.

        Raises:
            ValueError: If the name is blank or too long.
        """
        with self._begin_session() as session:
            row = _PresetRow.create(name, design=_copy_design(session))
            session.add(row)
            return row.to_preset()

    def list_presets(self) -> list[Preset]:
        """ Lists every preset.

        Returns:
            All presets, oldest first.
        """
        with self._begin_session() as session:
            rows = session.scalars(select(_PresetRow).order_by(_PresetRow.id))
            return [row.to_preset() for row in rows]

    def apply_preset(self, preset_id: UUID) -> bool:
        """ Makes the design what it was when a preset was saved, in place of everything in it now. The preset itself
        is kept. Does nothing if there is no such preset.

        Args:
            preset_id:
                Identifier of the preset to apply.

        Returns:
            Whether there was such a preset.
        """
        with self._begin_session() as session:
            preset_row = session.get(_PresetRow, preset_id)
            if preset_row is None:
                return False
            _clear_design(session)
            session.add_all(_DesignRow(kind=saved["kind"], id=saved["id"], fields=saved["fields"]) for saved in preset_row.design)
            return True

    def overwrite_preset(self, preset_id: UUID) -> bool:
        """ Replaces what a preset holds with the whole design as it is now, keeping the preset's name. Does nothing if
        there is no such preset.

        Args:
            preset_id:
                Identifier of the preset to save over.

        Returns:
            Whether there was such a preset.
        """
        with self._begin_session() as session:
            row = session.get(_PresetRow, preset_id)
            if row is None:
                return False
            row.design = _copy_design(session)
            row.saved_at = datetime.now(UTC).replace(tzinfo=None)
            return True

    def rename_preset(self, preset_id: UUID, name: str) -> bool:
        """ Renames a preset, leaving what it holds as it is. Does nothing if there is no such preset.

        Args:
            preset_id:
                Identifier of the preset to rename.
            name:
                Its new name. Must contain non-whitespace text, and be at most 80 characters.

        Returns:
            Whether there was such a preset.

        Raises:
            ValueError: If the name is blank or too long.
        """
        with self._begin_session() as session:
            row = session.get(_PresetRow, preset_id)
            if row is None:
                return False
            # Preset owns the rules for a valid name.
            Preset(id=row.id, name=name, saved_at=datetime.now(UTC))
            row.name = name
            return True

    def delete_preset(self, preset_id: UUID) -> None:
        """ Ensures that a preset is no longer kept. The design is left as it is. Does nothing if there is no such
        preset.

        Args:
            preset_id:
                Identifier of the preset to delete.
        """
        with self._begin_session() as session:
            session.execute(delete(_PresetRow).where(_PresetRow.id == preset_id))

    def _save(self, kind: str, design_id: str, fields: dict[str, Any]) -> None:
        with self._begin_session() as session:
            session.merge(_DesignRow(kind=kind, id=design_id, fields=fields))

    def _list(self, kind: str) -> dict[str, dict[str, Any]]:
        with self._begin_session() as session:
            rows = session.scalars(select(_DesignRow).where(_DesignRow.kind == kind).order_by(_DesignRow.id))
            return {row.id: row.fields for row in rows}

    def _delete(self, kind: str, design_id: str) -> None:
        with self._begin_session() as session:
            session.execute(delete(_DesignRow).where(_DesignRow.kind == kind, _DesignRow.id == design_id))


def _clear_design(session: Session) -> None:
    session.execute(delete(_DesignRow))


def _copy_design(session: Session) -> list[dict[str, Any]]:
    """ Gives every row of the design as it is now, each as its kind, id and fields, for a preset to hold. """
    return [{"kind": row.kind, "id": row.id, "fields": row.fields} for row in session.scalars(select(_DesignRow))]


class _PixelArtDBBase(DeclarativeBase):
    pass


class _DesignRow(_PixelArtDBBase):
    """ The database representation of one part of the design: a Picture, a LayerDesign or a SceneDesign. """
    __tablename__ = "designs"

    kind: Mapped[str] = mapped_column(primary_key=True)
    id: Mapped[str] = mapped_column(primary_key=True)
    # Each part is only ever read and replaced whole, so all of it is kept inside its row, as asdict gives its fields.
    fields: Mapped[dict[str, Any]] = mapped_column(JSON)


class _PresetRow(_PixelArtDBBase):
    """ The database representation of a Preset, and the design it saved. """
    __tablename__ = "design_presets"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    name: Mapped[str]
    saved_at: Mapped[datetime] = mapped_column(DateTime)
    # Every row of the design as it was, each as its kind, id and fields.
    design: Mapped[list[dict[str, Any]]] = mapped_column(JSON)

    @classmethod
    def create(cls, name: str, design: list[dict[str, Any]]) -> _PresetRow:
        """ Makes the row for a new preset, saved now, which holds the given design.

        Raises:
            ValueError: If the name is blank or too long.
        """
        preset = Preset(id=uuid7(), name=name, saved_at=datetime.now(UTC))
        # SQLite cannot store time zones, so the time is kept as naive UTC.
        return cls(id=preset.id, name=preset.name, saved_at=preset.saved_at.replace(tzinfo=None), design=design)

    def to_preset(self) -> Preset:
        return Preset(id=self.id, name=self.name, saved_at=self.saved_at.replace(tzinfo=UTC))


class _MarkerRow(_PixelArtDBBase):
    """ Records that something has been done to the database once, so that it is never done again. """
    __tablename__ = "markers"

    name: Mapped[str] = mapped_column(primary_key=True)


def _convert_fields_to_picture(fields: dict[str, Any]) -> Picture:
    variants = tuple(
        PictureVariant(
            name=variant["name"],
            palette=variant["palette"],
            frames=tuple(PictureFrame(rows=tuple(frame["rows"]), milliseconds=frame["milliseconds"]) for frame in variant["frames"]),
        )
        for variant in fields["variants"]
    )
    return Picture(variants=variants, title=fields["title"])


def _convert_fields_to_layer(fields: dict[str, Any]) -> LayerDesign:
    return LayerDesign(name=fields["name"], placements=tuple(ScenePlacement(**placement) for placement in fields["placements"]))


def _convert_fields_to_scene(fields: dict[str, Any]) -> SceneDesign:
    return SceneDesign(name=fields["name"], time_of_day=fields["time_of_day"], weather=fields["weather"], layer_ids=tuple(fields["layer_ids"]))
