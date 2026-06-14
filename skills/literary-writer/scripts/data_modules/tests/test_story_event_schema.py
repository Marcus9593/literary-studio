#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import pytest

from data_modules.story_event_schema import StoryEvent


def test_story_event_supports_power_breakthrough():
    event = StoryEvent.model_validate(
        {
            "event_id": "evt-001",
            "chapter": 3,
            "event_type": "power_breakthrough",
            "subject": "xiaoyan",
            "payload": {"from": "斗之气三段", "to": "斗者"},
        }
    )
    assert event.event_type == "power_breakthrough"


def test_story_event_rejects_unknown_event_type():
    with pytest.raises(ValueError):
        StoryEvent.model_validate(
            {
                "event_id": "evt-002",
                "chapter": 3,
                "event_type": "unknown_event",
                "subject": "xiaoyan",
                "payload": {},
            }
        )


def test_story_event_accepts_snyder_type():
    event = StoryEvent.model_validate(
        {
            "event_id": "evt-003",
            "chapter": 1,
            "event_type": "value_shift_occurred",
            "subject": "xiaoyan",
            "payload": {"dimension": "安全/危险", "from_value": "安全", "to_value": "危险"},
            "snyder_type": "monster_in_the_house",
        }
    )
    assert event.snyder_type == "monster_in_the_house"


def test_story_event_snyder_type_defaults_to_none():
    event = StoryEvent.model_validate(
        {
            "event_id": "evt-004",
            "chapter": 1,
            "event_type": "character_state_changed",
            "subject": "xiaoyan",
            "payload": {},
        }
    )
    assert event.snyder_type is None


def test_story_event_rejects_invalid_snyder_type():
    with pytest.raises(ValueError):
        StoryEvent.model_validate(
            {
                "event_id": "evt-005",
                "chapter": 1,
                "event_type": "character_state_changed",
                "subject": "xiaoyan",
                "payload": {},
                "snyder_type": "invalid_type",
            }
        )
