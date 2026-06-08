from __future__ import annotations

from typing import Any

from ha_testcontainer import HATestContainer
from ha_testcontainer.visual.scenario_runner import (
    Page,
    register_interaction_type,
)


# ---------------------------------------------------------------------------
# Handler implementations
# ---------------------------------------------------------------------------

def _entity_update_hidden_by(page: "Page | None", interaction: dict[str, Any], ha: Any = None) -> None:
    """Update the 'hidden_by' attribute of an entity via the HA entity registry WebSocket API.

    Resolves ``entity_id`` → ``device_id``
    automatically when the short-form keys are supplied.
    """
    __tracebackhide__ = True

    # --- Resolve entity_id ---
    if "entity_id" in interaction:
        entity_id: str = interaction["entity_id"]
    else:
        raise ValueError(
            "entity_registry_update: must supply 'entity_id' in interaction"
        )
    
    # -- Resolve hidden_by ---
    if "hidden_by" in interaction:
        hidden_by_dict = { "hidden_by": interaction["hidden_by"] }
    else:
        hidden_by_dict = { "hidden_by": None }

    # --- Update the entity ---
    result = ha._ws_call(
        {
            "id": 3,
            "type": "config/entity_registry/update",
            "entity_id": entity_id,
            **hidden_by_dict,
        }
    )
    if not result.get("success"):
        raise RuntimeError(
            f"entity_registry/update failed for entity {entity_id!r}: {result}"
        )
    
register_interaction_type("entity_update_hidden_by", _entity_update_hidden_by)