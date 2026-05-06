import { Experiment, ExperimentEvent } from "../../../../packages/shared-types/src";
import { matchesTargetingRules } from "./urlTargeting";

const now = new Date().toISOString();

const seedExperiments: Experiment[] = [
  {
    id: "exp_home_hero_v1",
    projectId: "demo-project",
    name: "Homepage hero replacement v1",
    status: "active",
    trafficAllocation: 100,
    targeting: {
      urlPatterns: ["*"]
    },
    variants: [
      {
        id: "control",
        name: "Control",
        weight: 50,
        isControl: true,
        operations: []
      },
      {
        id: "variant_a",
        name: "Variant A",
        weight: 50,
        operations: [
          {
            type: "set_text",
            selector: "[data-ab-id='hero-title']",
            text: "Ship experiments faster"
          },
          {
            type: "set_style",
            selector: "[data-ab-id='hero-cta']",
            styleMap: { "background-color": "#7c3aed", "color": "#ffffff", "border-radius": "8px" }
          },
          {
            type: "replace_html",
            selector: "[data-ab-id='hero-badge']",
            html: "<span data-ab-id=\"hero-badge\" style=\"background:#d1fae5;color:#065f46;padding:4px 10px;border-radius:12px;font-size:12px\">New ✓</span>",
            position: "outer"
          },
          {
            type: "move_before",
            sourceSelector: "[data-ab-id='social-proof']",
            targetSelector: "[data-ab-id='features']"
          },
          {
            type: "set_text",
            selector: "[data-ab-id='hero-sub']",
            text: "Trusted by 10,000+ product teams"
          },
          {
            type: "remove",
            selector: "[data-ab-id='promo-banner']"
          }
        ]
      }
    ],
    goals: [
      {
        id: "signup_click",
        name: "Signup click",
        type: "click"
      }
    ],
    createdAt: now,
    updatedAt: now
  }
];

class MemoryStore {
  private readonly experiments: Experiment[];
  private readonly events: ExperimentEvent[];

  constructor(initialExperiments: Experiment[]) {
    this.experiments = initialExperiments;
    this.events = [];
  }

  getActiveExperiments(projectId: string, pageUrl: string): Experiment[] {
    return this.experiments.filter((experiment) => {
      if (experiment.projectId !== projectId || experiment.status !== "active") {
        return false;
      }

      return matchesTargetingRules(pageUrl, experiment.targeting);
    });
  }

  appendEvents(events: ExperimentEvent[]): { accepted: number; rejected: number } {
    this.events.push(...events);
    return { accepted: events.length, rejected: 0 };
  }

  getEvents(): readonly ExperimentEvent[] {
    return this.events;
  }
}

export const memoryStore = new MemoryStore(seedExperiments);
