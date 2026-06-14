#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, Field

# 斯奈德 10 种故事类型（Save the Cat）
SnyderType = Literal[
    "monster_in_the_house",
    "golden_fleece",
    "out_of_the_bottle",
    "dude_with_a_problem",
    "rites_of_passage",
    "buddy_love",
    "whydunit",
    "fool_triumphant",
    "institutionalized",
    "superhero",
]


class ValueShiftPayload(BaseModel):
    """价值转变事件的 Payload 结构。

    基于麦基《故事》的价值转变理论，记录场景/章节中发生的
    核心价值维度位移。
    """

    dimension: str  # 价值维度对，如 "生/死"、"爱/恨"
    from_value: str  # 转变前状态，如 "安全"
    to_value: str  # 转变后状态，如 "危险"
    shift_type: Literal["positive", "negative", "ironic", "lateral"]
    magnitude: Literal["micro", "significant", "颠覆"]


class ArcStageChangedPayload(BaseModel):
    """弧光阶段变更事件的 Payload 结构。

    记录角色弧光从一个阶段转换到另一个阶段的时刻，
    用于驱动 arc-analyzer.js 的 6 阶段弧光追踪系统。
    """

    character_id: str  # 角色唯一标识
    character_name: str  # 角色名称
    from_stage: int = Field(ge=0, le=5)  # 原阶段索引（0-5）
    to_stage: int = Field(ge=0, le=5)  # 新阶段索引（0-5）
    arc_type: Literal["positive", "negative", "flat", "corruption", "mixed"] = "positive"
    trigger: str = ""  # 触发转换的事件描述
    description: str = ""  # 阶段转换的详细说明


class LieChallengedPayload(BaseModel):
    """谎言被挑战事件的 Payload 结构。

    记录角色所相信的谎言首次受到质疑或挑战的时刻，
    通常是弧光从「冲突」阶段进入「危机」阶段的信号。
    """

    character_id: str
    character_name: str
    lie: str  # 被挑战的谎言内容
    challenger: str = ""  # 挑战者（可以是另一个角色或事件）
    chapter: int = Field(ge=1)
    description: str = ""


class TruthDiscoveredPayload(BaseModel):
    """真相被发现事件的 Payload 结构。

    记录角色发现或接受核心真相的时刻，
    通常是弧光从「危机」阶段进入「高潮抉择」或「新平衡」阶段的信号。
    """

    character_id: str
    character_name: str
    truth: str  # 被发现的真相内容
    accepted: bool = True  # 角色是否接受了真相（True=正向弧光，False=负向弧光）
    chapter: int = Field(ge=1)
    description: str = ""


class StoryEvent(BaseModel):
    event_id: str
    chapter: int = Field(ge=1)
    event_type: Literal[
        "character_state_changed",
        "relationship_changed",
        "world_rule_revealed",
        "world_rule_broken",
        "power_breakthrough",
        "artifact_obtained",
        "promise_created",
        "promise_paid_off",
        "open_loop_created",
        "open_loop_closed",
        "value_shift_occurred",
        "gap_encountered",
        # 弧光追踪事件类型（P2-8）
        "arc_stage_changed",
        "lie_challenged",
        "truth_discovered",
    ]
    subject: str
    payload: Dict[str, Any] = Field(default_factory=dict)
    snyder_type: Optional[SnyderType] = Field(
        default=None,
        description="可选：该事件所属的斯奈德故事类型（Save the Cat）",
    )
