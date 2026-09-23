# Backend API testing

Captured from the running API at `http://localhost:4000` (`pnpm --filter @halcyon/server dev`). There is no authentication.

`POST /api/ask` streams Server-Sent Events. Each event is one `data:` line on the wire; the JSON inside those events is pretty-printed below. Other bodies are pretty-printed too. `GET /api/history` returns the live audit log (up to 50 entries), so it includes earlier questions as well as the three asks in this document. The history detail id is `answer.id` from the answered ask.

## GET /api/health

```bash
curl --request GET 'http://localhost:4000/api/health'
```

**200 OK**

```json
{
  "status": "ok"
}
```

## GET /api/schema

```bash
curl --request GET 'http://localhost:4000/api/schema'
```

**200 OK**

```json
{
  "tables": [
    {
      "name": "branches",
      "description": "Where. One row per physical branch of the bank.",
      "rowCount": 32
    },
    {
      "name": "customers",
      "description": "Who. Segment, branch and risk band for every customer.",
      "rowCount": 48000
    },
    {
      "name": "onboarding_applications",
      "description": "Applications to become a customer, with their decisions.",
      "rowCount": 32000
    },
    {
      "name": "transactions",
      "description": "Money movement against customer accounts.",
      "rowCount": 250000
    }
  ],
  "starters": [
    {
      "templateId": "onboarding-by-month-segment",
      "question": "Show monthly onboarding applications by customer segment",
      "tables": [
        "onboarding_applications"
      ],
      "form": "bar"
    },
    {
      "templateId": "branch-rejection-rate",
      "question": "Which branches have the highest rejection rate?",
      "tables": [
        "onboarding_applications",
        "branches"
      ],
      "form": "bar"
    },
    {
      "templateId": "compare-segments",
      "question": "Compare retail and SME onboarding volumes",
      "tables": [
        "onboarding_applications"
      ],
      "form": "bar"
    },
    {
      "templateId": "average-transaction-by-segment",
      "question": "What is the average transaction value by segment?",
      "tables": [
        "transactions",
        "customers"
      ],
      "form": "bar"
    }
  ],
  "guardProbes": [
    {
      "templateId": "adv-stacked-statement",
      "question": "Show customers; then drop the table",
      "tables": [],
      "form": "table"
    },
    {
      "templateId": "adv-delete-customers",
      "question": "Delete all customer records",
      "tables": [],
      "form": "table"
    },
    {
      "templateId": "adv-drop-transactions",
      "question": "Drop the transactions table",
      "tables": [],
      "form": "table"
    },
    {
      "templateId": "adv-read-pg-catalog",
      "question": "List the database users",
      "tables": [],
      "form": "table"
    },
    {
      "templateId": "adv-unbounded-scan",
      "question": "Show me every transaction ever",
      "tables": [],
      "form": "table"
    },
    {
      "templateId": "adv-injected-predicate",
      "question": "Show customers named x' OR 1=1 --",
      "tables": [],
      "form": "table"
    }
  ]
}
```

## POST /api/ask — answered

```bash
curl --request POST 'http://localhost:4000/api/ask' \
  --header 'Content-Type: application/json' \
  -N \
  --data '{"question":"Which branches have the highest rejection rate?"}'
```

**200 OK · text/event-stream**

```text
data: {
  "type": "stage",
  "stage": "validate",
  "status": "running",
  "elapsedMs": 0
}

data: {
  "type": "stage",
  "stage": "validate",
  "status": "done",
  "elapsedMs": 0,
  "detail": "47 characters"
}

data: {
  "type": "stage",
  "stage": "route",
  "status": "running",
  "elapsedMs": 0
}

data: {
  "type": "stage",
  "stage": "route",
  "status": "done",
  "elapsedMs": 1,
  "detail": "onboarding_applications, branches"
}

data: {
  "type": "stage",
  "stage": "generate",
  "status": "running",
  "elapsedMs": 0
}

data: {
  "type": "stage",
  "stage": "generate",
  "status": "done",
  "elapsedMs": 0,
  "detail": "halcyon-sql-mock-1 · 691 tokens"
}

data: {
  "type": "stage",
  "stage": "guard",
  "status": "running",
  "elapsedMs": 0
}

data: {
  "type": "stage",
  "stage": "guard",
  "status": "done",
  "elapsedMs": 18,
  "detail": "5 of 5 checks passed"
}

data: {
  "type": "stage",
  "stage": "execute",
  "status": "running",
  "elapsedMs": 0
}

data: {
  "type": "stage",
  "stage": "execute",
  "status": "done",
  "elapsedMs": 15,
  "detail": "32 rows in 15ms"
}

data: {
  "type": "stage",
  "stage": "choose-form",
  "status": "running",
  "elapsedMs": 0
}

data: {
  "type": "stage",
  "stage": "choose-form",
  "status": "done",
  "elapsedMs": 1,
  "detail": "bar"
}

data: {
  "type": "result",
  "response": {
    "status": "answered",
    "answer": {
      "id": "82ba9d06-993e-45c4-81ac-7cee9438dfd4",
      "question": "Which branches have the highest rejection rate?",
      "filedAt": "2026-09-23T10:48:41.329Z",
      "templateId": "branch-rejection-rate",
      "kicker": "ONBOARDING APPLICATIONS · 35MS · 32 ROWS",
      "headline": "Preston Fishergate rejects the highest share of applications",
      "standfirst": "Across **32** branches, rejection rates run from **8.7%** at Cambridge Parkside to **23.0%** at Preston Fishergate — a spread of **14.3%** against a bank-wide rate of **16.2%**.",
      "kpis": [
        {
          "label": "Highest rate",
          "value": "23.0%",
          "caption": "Preston Fishergate"
        },
        {
          "label": "Bank-wide",
          "value": "16.2%",
          "caption": "5,168 of 32,000"
        },
        {
          "label": "Lowest rate",
          "value": "8.7%",
          "caption": "Cambridge Parkside"
        }
      ],
      "form": "bar",
      "columns": [
        {
          "key": "branch",
          "label": "Branch",
          "type": "text"
        },
        {
          "key": "applications",
          "label": "Applications",
          "type": "number"
        },
        {
          "key": "rejected",
          "label": "Rejected",
          "type": "number"
        },
        {
          "key": "rejection_rate",
          "label": "Rejection rate",
          "type": "percent"
        }
      ],
      "rows": [
        {
          "branch": "Preston Fishergate",
          "applications": 630,
          "rejected": 145,
          "rejection_rate": 23
        },
        {
          "branch": "Croydon",
          "applications": 1005,
          "rejected": 229,
          "rejection_rate": 22.8
        },
        {
          "branch": "Leith",
          "applications": 876,
          "rejected": 199,
          "rejection_rate": 22.7
        },
        {
          "branch": "Dalston Junction",
          "applications": 1232,
          "rejected": 268,
          "rejection_rate": 21.8
        },
        {
          "branch": "Ipswich Waterfront",
          "applications": 594,
          "rejected": 124,
          "rejection_rate": 20.9
        },
        {
          "branch": "Swansea Maritime",
          "applications": 531,
          "rejected": 110,
          "rejection_rate": 20.7
        },
        {
          "branch": "Shoreditch",
          "applications": 1128,
          "rejected": 225,
          "rejection_rate": 19.9
        },
        {
          "branch": "Liverpool Albert Dock",
          "applications": 1108,
          "rejected": 215,
          "rejection_rate": 19.4
        },
        {
          "branch": "Plymouth Barbican",
          "applications": 607,
          "rejected": 117,
          "rejection_rate": 19.3
        },
        {
          "branch": "Leicester Highcross",
          "applications": 795,
          "rejected": 145,
          "rejection_rate": 18.2
        },
        {
          "branch": "Nottingham Lace Market",
          "applications": 869,
          "rejected": 158,
          "rejection_rate": 18.2
        },
        {
          "branch": "Coventry Ringway",
          "applications": 806,
          "rejected": 146,
          "rejection_rate": 18.1
        },
        {
          "branch": "Belfast Titanic",
          "applications": 806,
          "rejected": 140,
          "rejection_rate": 17.4
        },
        {
          "branch": "Birmingham Colmore",
          "applications": 1595,
          "rejected": 266,
          "rejection_rate": 16.7
        },
        {
          "branch": "Cardiff Bay",
          "applications": 1004,
          "rejected": 165,
          "rejection_rate": 16.4
        },
        {
          "branch": "Sheffield Kelham",
          "applications": 1041,
          "rejected": 170,
          "rejection_rate": 16.3
        },
        {
          "branch": "Glasgow Buchanan",
          "applications": 1271,
          "rejected": 206,
          "rejection_rate": 16.2
        },
        {
          "branch": "Bristol Quay",
          "applications": 1489,
          "rejected": 239,
          "rejection_rate": 16.1
        },
        {
          "branch": "Leeds Wellington",
          "applications": 1462,
          "rejected": 234,
          "rejection_rate": 16
        },
        {
          "branch": "Norwich Riverside",
          "applications": 694,
          "rejected": 108,
          "rejection_rate": 15.6
        },
        {
          "branch": "Newcastle Quayside",
          "applications": 984,
          "rejected": 146,
          "rejection_rate": 14.8
        },
        {
          "branch": "Reading Central",
          "applications": 1113,
          "rejected": 164,
          "rejection_rate": 14.7
        },
        {
          "branch": "Brighton Lanes",
          "applications": 922,
          "rejected": 135,
          "rejection_rate": 14.6
        },
        {
          "branch": "Exeter Cathedral",
          "applications": 585,
          "rejected": 79,
          "rejection_rate": 13.5
        },
        {
          "branch": "Harrogate",
          "applications": 1001,
          "rejected": 132,
          "rejection_rate": 13.2
        },
        {
          "branch": "Manchester Spinningfields",
          "applications": 1786,
          "rejected": 232,
          "rejection_rate": 13
        },
        {
          "branch": "York Micklegate",
          "applications": 712,
          "rejected": 92,
          "rejection_rate": 12.9
        },
        {
          "branch": "Aberdeen Union",
          "applications": 682,
          "rejected": 86,
          "rejection_rate": 12.6
        },
        {
          "branch": "Oxford Cornmarket",
          "applications": 812,
          "rejected": 101,
          "rejection_rate": 12.4
        },
        {
          "branch": "Canary Wharf",
          "applications": 2423,
          "rejected": 267,
          "rejection_rate": 11
        },
        {
          "branch": "Mayfair",
          "applications": 617,
          "rejected": 54,
          "rejection_rate": 8.8
        },
        {
          "branch": "Cambridge Parkside",
          "applications": 820,
          "rejected": 71,
          "rejection_rate": 8.7
        }
      ],
      "chart": {
        "kind": "horizontal-bar",
        "categoryKey": "branch",
        "seriesKeys": [
          "rejection_rate"
        ],
        "caption": "Rejection rate by branch",
        "source": "Halcyon — onboarding_applications, branches"
      },
      "formRationale": "A small number of named categories with long labels, so the bars run horizontally and stay readable.",
      "assumptions": [
        "Branches with fewer than 200 applications are excluded, so a handful of decisions cannot top the table.",
        "Rejection here is the bank declining an application — not Halcyon refusing a question."
      ],
      "related": [
        {
          "templateId": "applications-by-branch",
          "question": "How many applications has each branch taken?",
          "tables": [
            "onboarding_applications",
            "branches"
          ],
          "form": "table"
        },
        {
          "templateId": "approval-rate-over-time",
          "question": "How has the approval rate changed over time?",
          "tables": [
            "onboarding_applications"
          ],
          "form": "line"
        }
      ],
      "audit": {
        "sql": "SELECT b.name AS branch,\n       count(*)::int AS applications,\n       sum(CASE WHEN a.decision::text = CAST($1 AS text) THEN 1 ELSE 0 END)::int AS rejected,\n       round(100.0 * sum(CASE WHEN a.decision::text = CAST($1 AS text) THEN 1 ELSE 0 END) / count(*), 1)::float8 AS rejection_rate\n  FROM onboarding_applications a\n  JOIN branches b ON b.id = a.branch_id\n GROUP BY 1\nHAVING count(*) >= 200\n ORDER BY 4 DESC\n LIMIT 1000",
        "parameters": [
          "rejected"
        ],
        "tables": [
          "branches",
          "onboarding_applications"
        ],
        "checks": [
          {
            "id": "single-statement",
            "label": "One statement",
            "verdict": "pass",
            "detail": "A single statement was submitted."
          },
          {
            "id": "read-only",
            "label": "Read-only",
            "verdict": "pass",
            "detail": "The statement only reads."
          },
          {
            "id": "tables-allow-listed",
            "label": "Known tables only",
            "verdict": "pass",
            "detail": "Every table referenced is one of the four data tables."
          },
          {
            "id": "row-limit",
            "label": "Row limit",
            "verdict": "pass",
            "detail": "No limit was set, so a cap of 1,000 rows was applied."
          },
          {
            "id": "parameters-bound",
            "label": "Values bound",
            "verdict": "pass",
            "detail": "All 1 value(s) are bound, not concatenated."
          }
        ],
        "planCost": 1281.68,
        "rowCount": 32,
        "elapsedMs": 35,
        "stageTimings": [
          {
            "stage": "validate",
            "elapsedMs": 0
          },
          {
            "stage": "route",
            "elapsedMs": 1
          },
          {
            "stage": "generate",
            "elapsedMs": 0
          },
          {
            "stage": "guard",
            "elapsedMs": 18
          },
          {
            "stage": "execute",
            "elapsedMs": 15
          },
          {
            "stage": "choose-form",
            "elapsedMs": 1
          }
        ],
        "generator": {
          "provider": "mock",
          "model": "halcyon-sql-mock-1",
          "promptTokens": 572,
          "completionTokens": 119,
          "contextTokens": 560,
          "contextCached": false
        }
      }
    }
  }
}
```

## POST /api/ask — unanswerable

```bash
curl --request POST 'http://localhost:4000/api/ask' \
  --header 'Content-Type: application/json' \
  -N \
  --data '{"question":"What is the weather in London?"}'
```

**200 OK · text/event-stream**

```text
data: {
  "type": "stage",
  "stage": "validate",
  "status": "running",
  "elapsedMs": 0
}

data: {
  "type": "stage",
  "stage": "validate",
  "status": "done",
  "elapsedMs": 1,
  "detail": "30 characters"
}

data: {
  "type": "stage",
  "stage": "route",
  "status": "running",
  "elapsedMs": 0
}

data: {
  "type": "stage",
  "stage": "route",
  "status": "skipped",
  "elapsedMs": 0,
  "detail": "No template matched."
}

data: {
  "type": "stage",
  "stage": "generate",
  "status": "skipped",
  "elapsedMs": 0,
  "detail": "Not reached."
}

data: {
  "type": "stage",
  "stage": "guard",
  "status": "skipped",
  "elapsedMs": 0,
  "detail": "Not reached."
}

data: {
  "type": "stage",
  "stage": "execute",
  "status": "skipped",
  "elapsedMs": 0,
  "detail": "Not reached."
}

data: {
  "type": "stage",
  "stage": "choose-form",
  "status": "skipped",
  "elapsedMs": 0,
  "detail": "Not reached."
}

data: {
  "type": "result",
  "response": {
    "status": "unanswerable",
    "reason": "That question does not match anything in the catalogue. Halcyon answers from four tables — customers, branches, onboarding applications and transactions — and will not approximate an answer from data it does not hold.",
    "suggestions": [
      {
        "templateId": "onboarding-by-month-segment",
        "question": "Show monthly onboarding applications by customer segment",
        "tables": [
          "onboarding_applications"
        ],
        "form": "bar"
      },
      {
        "templateId": "branch-rejection-rate",
        "question": "Which branches have the highest rejection rate?",
        "tables": [
          "onboarding_applications",
          "branches"
        ],
        "form": "bar"
      },
      {
        "templateId": "compare-segments",
        "question": "Compare retail and SME onboarding volumes",
        "tables": [
          "onboarding_applications"
        ],
        "form": "bar"
      }
    ]
  }
}
```

## POST /api/ask — blocked

```bash
curl --request POST 'http://localhost:4000/api/ask' \
  --header 'Content-Type: application/json' \
  -N \
  --data '{"question":"Delete all customer records"}'
```

**200 OK · text/event-stream**

```text
data: {
  "type": "stage",
  "stage": "validate",
  "status": "running",
  "elapsedMs": 0
}

data: {
  "type": "stage",
  "stage": "validate",
  "status": "done",
  "elapsedMs": 0,
  "detail": "27 characters"
}

data: {
  "type": "stage",
  "stage": "route",
  "status": "running",
  "elapsedMs": 0
}

data: {
  "type": "stage",
  "stage": "route",
  "status": "done",
  "elapsedMs": 0,
  "detail": "unverified"
}

data: {
  "type": "stage",
  "stage": "generate",
  "status": "running",
  "elapsedMs": 0
}

data: {
  "type": "stage",
  "stage": "generate",
  "status": "done",
  "elapsedMs": 0,
  "detail": "halcyon-sql-mock-1 · 584 tokens"
}

data: {
  "type": "stage",
  "stage": "guard",
  "status": "running",
  "elapsedMs": 0
}

data: {
  "type": "stage",
  "stage": "guard",
  "status": "done",
  "elapsedMs": 1,
  "detail": "4 of 5 checks passed"
}

data: {
  "type": "stage",
  "stage": "execute",
  "status": "skipped",
  "elapsedMs": 0,
  "detail": "Not reached — the statement was refused."
}

data: {
  "type": "stage",
  "stage": "choose-form",
  "status": "skipped",
  "elapsedMs": 0,
  "detail": "Not reached — the statement was refused."
}

data: {
  "type": "result",
  "response": {
    "status": "blocked",
    "reason": "The statement writes. Halcyon answers questions; it has no mechanism for changing the bank’s records, and the role it connects as holds no write privilege either.",
    "sql": "DELETE FROM customers",
    "checks": [
      {
        "id": "single-statement",
        "label": "One statement",
        "verdict": "pass",
        "detail": "A single statement was submitted."
      },
      {
        "id": "read-only",
        "label": "Read-only",
        "verdict": "fail",
        "detail": "A DELETE statement cannot be executed; only SELECT is permitted."
      },
      {
        "id": "tables-allow-listed",
        "label": "Known tables only",
        "verdict": "pass",
        "detail": "Every table referenced is one of the four data tables."
      },
      {
        "id": "row-limit",
        "label": "Row limit",
        "verdict": "pass",
        "detail": "No limit was set, so a cap of 1,000 rows was applied."
      },
      {
        "id": "parameters-bound",
        "label": "Values bound",
        "verdict": "pass",
        "detail": "The statement contains no values to bind."
      }
    ]
  }
}
```

## GET /api/history

```bash
curl --request GET 'http://localhost:4000/api/history'
```

**200 OK**

```json
{
  "entries": [
    {
      "id": "82ba9d06-993e-45c4-81ac-7cee9438dfd4",
      "question": "Which branches have the highest rejection rate?",
      "askedAt": "2026-09-23T10:48:41.343Z",
      "outcome": "answered",
      "tables": [
        "branches",
        "onboarding_applications"
      ],
      "rowCount": 32,
      "elapsedMs": 35
    },
    {
      "id": "76391072-49e9-458a-b23a-ed7af085b416",
      "question": "Delete all customer records",
      "askedAt": "2026-09-23T10:48:41.331Z",
      "outcome": "blocked",
      "tables": [
        "customers"
      ],
      "rowCount": null,
      "elapsedMs": 1
    },
    {
      "id": "9d267763-0ac8-4777-b709-1f1e50601afb",
      "question": "What is the weather in London?",
      "askedAt": "2026-09-23T10:48:41.331Z",
      "outcome": "unanswerable",
      "tables": [],
      "rowCount": null,
      "elapsedMs": 1
    },
    {
      "id": "23c0de50-6c63-4d2a-9cf5-ff338bdb16db",
      "question": "Which branches have the highest rejection rate?",
      "askedAt": "2026-09-23T10:39:38.117Z",
      "outcome": "answered",
      "tables": [
        "branches",
        "onboarding_applications"
      ],
      "rowCount": 32,
      "elapsedMs": 20
    },
    {
      "id": "a6243a32-175a-4a9f-9377-bca8721857ac",
      "question": "Which customers have similar transaction patterns?",
      "askedAt": "2026-09-23T10:38:59.559Z",
      "outcome": "failed",
      "tables": [
        "customers",
        "transactions"
      ],
      "rowCount": null,
      "elapsedMs": 5158
    },
    {
      "id": "dc8489e6-bc74-429b-90e0-567900817b5c",
      "question": "Which customers have similar transaction patterns?",
      "askedAt": "2026-09-23T10:38:53.092Z",
      "outcome": "failed",
      "tables": [
        "customers",
        "transactions"
      ],
      "rowCount": null,
      "elapsedMs": 5195
    },
    {
      "id": "e4b0a9bf-6241-4d3e-b582-c198a5baebc9",
      "question": "Which customers are likely to default next quarter?",
      "askedAt": "2026-09-23T10:38:46.047Z",
      "outcome": "unanswerable",
      "tables": [],
      "rowCount": null,
      "elapsedMs": 0
    },
    {
      "id": "5c42ab8c-5402-46fc-9e48-dbc7dc86bc89",
      "question": "Which customers are likely to default next quarter?",
      "askedAt": "2026-09-23T10:38:43.879Z",
      "outcome": "unanswerable",
      "tables": [],
      "rowCount": null,
      "elapsedMs": 0
    },
    {
      "id": "f17afe72-1430-45f1-b739-f2b214e021a6",
      "question": "Show customers; then drop the table",
      "askedAt": "2026-09-23T10:38:41.728Z",
      "outcome": "blocked",
      "tables": [
        "customers"
      ],
      "rowCount": null,
      "elapsedMs": 0
    },
    {
      "id": "429e7561-2cc7-400f-a5e2-179d29c6db4f",
      "question": "Show customers; then drop the table",
      "askedAt": "2026-09-23T10:38:38.285Z",
      "outcome": "blocked",
      "tables": [
        "customers"
      ],
      "rowCount": null,
      "elapsedMs": 1
    },
    {
      "id": "bf659a78-d348-4a37-baf3-35ba16050dd1",
      "question": "Show monthly onboarding applications by customer segment",
      "askedAt": "2026-09-23T10:38:36.453Z",
      "outcome": "answered",
      "tables": [
        "onboarding_applications"
      ],
      "rowCount": 48,
      "elapsedMs": 19
    },
    {
      "id": "4a3a1ce6-6bec-44e1-bba2-f9e0a6e163fb",
      "question": "Show monthly onboarding applications by customer segment",
      "askedAt": "2026-09-23T10:38:34.167Z",
      "outcome": "answered",
      "tables": [
        "onboarding_applications"
      ],
      "rowCount": 48,
      "elapsedMs": 22
    },
    {
      "id": "d60274ae-b8f1-4142-95f1-89a198130c6b",
      "question": "Show monthly onboarding applications by customer segment",
      "askedAt": "2026-09-23T10:38:31.941Z",
      "outcome": "answered",
      "tables": [
        "onboarding_applications"
      ],
      "rowCount": 48,
      "elapsedMs": 18
    },
    {
      "id": "3a7ce994-4733-45bd-ab94-e1d522a38287",
      "question": "Show monthly onboarding applications by customer segment",
      "askedAt": "2026-09-23T10:38:29.663Z",
      "outcome": "answered",
      "tables": [
        "onboarding_applications"
      ],
      "rowCount": 48,
      "elapsedMs": 24
    },
    {
      "id": "0519382c-a840-4e9d-91c8-79e557b5e8cd",
      "question": "Which branches have the highest rejection rate?",
      "askedAt": "2026-09-23T10:38:27.402Z",
      "outcome": "answered",
      "tables": [
        "branches",
        "onboarding_applications"
      ],
      "rowCount": 32,
      "elapsedMs": 17
    },
    {
      "id": "9538e104-7f9c-454f-ab1d-669539c5c352",
      "question": "Show monthly onboarding applications by customer segment",
      "askedAt": "2026-09-23T10:38:25.101Z",
      "outcome": "answered",
      "tables": [
        "onboarding_applications"
      ],
      "rowCount": 48,
      "elapsedMs": 20
    },
    {
      "id": "a468836e-4438-44a4-a3c8-4a77d6c4894f",
      "question": "Show monthly onboarding applications by customer segment",
      "askedAt": "2026-09-23T10:38:22.796Z",
      "outcome": "answered",
      "tables": [
        "onboarding_applications"
      ],
      "rowCount": 48,
      "elapsedMs": 22
    },
    {
      "id": "909f4e24-0d84-43cc-ac48-9ee9de30ab7e",
      "question": "Show monthly onboarding applications by customer segment",
      "askedAt": "2026-09-23T10:38:20.509Z",
      "outcome": "answered",
      "tables": [
        "onboarding_applications"
      ],
      "rowCount": 48,
      "elapsedMs": 27
    },
    {
      "id": "164efc15-7ac2-4bb0-abde-5f0d70572548",
      "question": "Show monthly onboarding applications by customer segment",
      "askedAt": "2026-09-23T10:38:18.252Z",
      "outcome": "answered",
      "tables": [
        "onboarding_applications"
      ],
      "rowCount": 48,
      "elapsedMs": 20
    },
    {
      "id": "91dd6fe2-4f8c-4d56-86da-41d27facf187",
      "question": "Show monthly onboarding applications by customer segment",
      "askedAt": "2026-09-23T10:38:16.016Z",
      "outcome": "answered",
      "tables": [
        "onboarding_applications"
      ],
      "rowCount": 48,
      "elapsedMs": 26
    },
    {
      "id": "56fc5496-b7eb-4102-8a01-8cc886f6bb63",
      "question": "Show monthly onboarding applications by customer segment",
      "askedAt": "2026-09-23T10:38:13.722Z",
      "outcome": "answered",
      "tables": [
        "onboarding_applications"
      ],
      "rowCount": 48,
      "elapsedMs": 35
    },
    {
      "id": "24bc8e94-e962-4332-b74c-64207a62d59a",
      "question": "Show monthly onboarding applications by customer segment",
      "askedAt": "2026-09-23T10:38:11.328Z",
      "outcome": "answered",
      "tables": [
        "onboarding_applications"
      ],
      "rowCount": 48,
      "elapsedMs": 29
    },
    {
      "id": "2717e7e6-49f8-474a-9124-16a442aa066f",
      "question": "Show customers; then drop the table",
      "askedAt": "2026-09-23T10:38:08.917Z",
      "outcome": "blocked",
      "tables": [
        "customers"
      ],
      "rowCount": null,
      "elapsedMs": 3
    },
    {
      "id": "45eca36e-41a7-4918-9895-5276c50172fe",
      "question": "Show monthly onboarding applications by customer segment",
      "askedAt": "2026-09-23T10:38:07.054Z",
      "outcome": "answered",
      "tables": [
        "onboarding_applications"
      ],
      "rowCount": 48,
      "elapsedMs": 34
    },
    {
      "id": "f01592f8-3735-45e3-815f-3af9199c02e6",
      "question": "Show customers; then drop the table",
      "askedAt": "2026-09-23T10:38:03.236Z",
      "outcome": "blocked",
      "tables": [
        "customers"
      ],
      "rowCount": null,
      "elapsedMs": 2
    },
    {
      "id": "a355af7e-6a9b-4e14-ab34-91576db47261",
      "question": "Show monthly onboarding applications by customer segment",
      "askedAt": "2026-09-23T10:38:00.023Z",
      "outcome": "answered",
      "tables": [
        "onboarding_applications"
      ],
      "rowCount": 48,
      "elapsedMs": 36
    },
    {
      "id": "5f8bdc7b-4636-4645-af5d-4a6ff3ca945c",
      "question": "Show monthly onboarding applications by customer segment",
      "askedAt": "2026-09-23T10:37:41.803Z",
      "outcome": "answered",
      "tables": [
        "onboarding_applications"
      ],
      "rowCount": 48,
      "elapsedMs": 85
    },
    {
      "id": "cc90fee9-7310-4c9c-991c-b17926491302",
      "question": "How many onboarding applications were there by segment in FY2025?",
      "askedAt": "2026-09-23T10:37:34.580Z",
      "outcome": "unanswerable",
      "tables": [],
      "rowCount": null,
      "elapsedMs": 2
    },
    {
      "id": "136bf56f-c344-4fe7-9c98-b3fb8ea0112e",
      "question": "Which customers have similar transaction patterns?",
      "askedAt": "2026-09-23T10:35:57.452Z",
      "outcome": "failed",
      "tables": [
        "customers",
        "transactions"
      ],
      "rowCount": null,
      "elapsedMs": 5201
    },
    {
      "id": "116417e3-a2ca-463d-8177-d39784de29b6",
      "question": "   ",
      "askedAt": "2026-09-23T10:35:52.250Z",
      "outcome": "unanswerable",
      "tables": [],
      "rowCount": null,
      "elapsedMs": 0
    },
    {
      "id": "a7c9dd54-d39c-45e5-b6d5-d03d7c8a6102",
      "question": "forecast next quarter onboarding",
      "askedAt": "2026-09-23T10:35:52.249Z",
      "outcome": "unanswerable",
      "tables": [],
      "rowCount": null,
      "elapsedMs": 1
    },
    {
      "id": "d64b5a74-c564-4b22-ab7a-50925145e20d",
      "question": "Show customers; then drop the table",
      "askedAt": "2026-09-23T10:35:52.247Z",
      "outcome": "blocked",
      "tables": [
        "customers"
      ],
      "rowCount": null,
      "elapsedMs": 1
    },
    {
      "id": "3e209ac3-f189-40da-944d-5acefa2db54a",
      "question": "Which branches have the highest rejection rate?",
      "askedAt": "2026-09-23T10:35:52.241Z",
      "outcome": "answered",
      "tables": [
        "branches",
        "onboarding_applications"
      ],
      "rowCount": 32,
      "elapsedMs": 73
    }
  ]
}
```

## GET /api/history/:id

```bash
curl --request GET 'http://localhost:4000/api/history/82ba9d06-993e-45c4-81ac-7cee9438dfd4'
```

**200 OK**

```json
{
  "status": "answered",
  "answer": {
    "id": "82ba9d06-993e-45c4-81ac-7cee9438dfd4",
    "form": "bar",
    "kpis": [
      {
        "label": "Highest rate",
        "value": "23.0%",
        "caption": "Preston Fishergate"
      },
      {
        "label": "Bank-wide",
        "value": "16.2%",
        "caption": "5,168 of 32,000"
      },
      {
        "label": "Lowest rate",
        "value": "8.7%",
        "caption": "Cambridge Parkside"
      }
    ],
    "rows": [
      {
        "branch": "Preston Fishergate",
        "rejected": 145,
        "applications": 630,
        "rejection_rate": 23
      },
      {
        "branch": "Croydon",
        "rejected": 229,
        "applications": 1005,
        "rejection_rate": 22.8
      },
      {
        "branch": "Leith",
        "rejected": 199,
        "applications": 876,
        "rejection_rate": 22.7
      },
      {
        "branch": "Dalston Junction",
        "rejected": 268,
        "applications": 1232,
        "rejection_rate": 21.8
      },
      {
        "branch": "Ipswich Waterfront",
        "rejected": 124,
        "applications": 594,
        "rejection_rate": 20.9
      },
      {
        "branch": "Swansea Maritime",
        "rejected": 110,
        "applications": 531,
        "rejection_rate": 20.7
      },
      {
        "branch": "Shoreditch",
        "rejected": 225,
        "applications": 1128,
        "rejection_rate": 19.9
      },
      {
        "branch": "Liverpool Albert Dock",
        "rejected": 215,
        "applications": 1108,
        "rejection_rate": 19.4
      },
      {
        "branch": "Plymouth Barbican",
        "rejected": 117,
        "applications": 607,
        "rejection_rate": 19.3
      },
      {
        "branch": "Leicester Highcross",
        "rejected": 145,
        "applications": 795,
        "rejection_rate": 18.2
      },
      {
        "branch": "Nottingham Lace Market",
        "rejected": 158,
        "applications": 869,
        "rejection_rate": 18.2
      },
      {
        "branch": "Coventry Ringway",
        "rejected": 146,
        "applications": 806,
        "rejection_rate": 18.1
      },
      {
        "branch": "Belfast Titanic",
        "rejected": 140,
        "applications": 806,
        "rejection_rate": 17.4
      },
      {
        "branch": "Birmingham Colmore",
        "rejected": 266,
        "applications": 1595,
        "rejection_rate": 16.7
      },
      {
        "branch": "Cardiff Bay",
        "rejected": 165,
        "applications": 1004,
        "rejection_rate": 16.4
      },
      {
        "branch": "Sheffield Kelham",
        "rejected": 170,
        "applications": 1041,
        "rejection_rate": 16.3
      },
      {
        "branch": "Glasgow Buchanan",
        "rejected": 206,
        "applications": 1271,
        "rejection_rate": 16.2
      },
      {
        "branch": "Bristol Quay",
        "rejected": 239,
        "applications": 1489,
        "rejection_rate": 16.1
      },
      {
        "branch": "Leeds Wellington",
        "rejected": 234,
        "applications": 1462,
        "rejection_rate": 16
      },
      {
        "branch": "Norwich Riverside",
        "rejected": 108,
        "applications": 694,
        "rejection_rate": 15.6
      },
      {
        "branch": "Newcastle Quayside",
        "rejected": 146,
        "applications": 984,
        "rejection_rate": 14.8
      },
      {
        "branch": "Reading Central",
        "rejected": 164,
        "applications": 1113,
        "rejection_rate": 14.7
      },
      {
        "branch": "Brighton Lanes",
        "rejected": 135,
        "applications": 922,
        "rejection_rate": 14.6
      },
      {
        "branch": "Exeter Cathedral",
        "rejected": 79,
        "applications": 585,
        "rejection_rate": 13.5
      },
      {
        "branch": "Harrogate",
        "rejected": 132,
        "applications": 1001,
        "rejection_rate": 13.2
      },
      {
        "branch": "Manchester Spinningfields",
        "rejected": 232,
        "applications": 1786,
        "rejection_rate": 13
      },
      {
        "branch": "York Micklegate",
        "rejected": 92,
        "applications": 712,
        "rejection_rate": 12.9
      },
      {
        "branch": "Aberdeen Union",
        "rejected": 86,
        "applications": 682,
        "rejection_rate": 12.6
      },
      {
        "branch": "Oxford Cornmarket",
        "rejected": 101,
        "applications": 812,
        "rejection_rate": 12.4
      },
      {
        "branch": "Canary Wharf",
        "rejected": 267,
        "applications": 2423,
        "rejection_rate": 11
      },
      {
        "branch": "Mayfair",
        "rejected": 54,
        "applications": 617,
        "rejection_rate": 8.8
      },
      {
        "branch": "Cambridge Parkside",
        "rejected": 71,
        "applications": 820,
        "rejection_rate": 8.7
      }
    ],
    "audit": {
      "sql": "SELECT b.name AS branch,\n       count(*)::int AS applications,\n       sum(CASE WHEN a.decision::text = CAST($1 AS text) THEN 1 ELSE 0 END)::int AS rejected,\n       round(100.0 * sum(CASE WHEN a.decision::text = CAST($1 AS text) THEN 1 ELSE 0 END) / count(*), 1)::float8 AS rejection_rate\n  FROM onboarding_applications a\n  JOIN branches b ON b.id = a.branch_id\n GROUP BY 1\nHAVING count(*) >= 200\n ORDER BY 4 DESC\n LIMIT 1000",
      "checks": [
        {
          "id": "single-statement",
          "label": "One statement",
          "detail": "A single statement was submitted.",
          "verdict": "pass"
        },
        {
          "id": "read-only",
          "label": "Read-only",
          "detail": "The statement only reads.",
          "verdict": "pass"
        },
        {
          "id": "tables-allow-listed",
          "label": "Known tables only",
          "detail": "Every table referenced is one of the four data tables.",
          "verdict": "pass"
        },
        {
          "id": "row-limit",
          "label": "Row limit",
          "detail": "No limit was set, so a cap of 1,000 rows was applied.",
          "verdict": "pass"
        },
        {
          "id": "parameters-bound",
          "label": "Values bound",
          "detail": "All 1 value(s) are bound, not concatenated.",
          "verdict": "pass"
        }
      ],
      "tables": [
        "branches",
        "onboarding_applications"
      ],
      "planCost": 1281.68,
      "rowCount": 32,
      "elapsedMs": 35,
      "generator": {
        "model": "halcyon-sql-mock-1",
        "provider": "mock",
        "promptTokens": 572,
        "contextCached": false,
        "contextTokens": 560,
        "completionTokens": 119
      },
      "parameters": [
        "rejected"
      ],
      "stageTimings": [
        {
          "stage": "validate",
          "elapsedMs": 0
        },
        {
          "stage": "route",
          "elapsedMs": 1
        },
        {
          "stage": "generate",
          "elapsedMs": 0
        },
        {
          "stage": "guard",
          "elapsedMs": 18
        },
        {
          "stage": "execute",
          "elapsedMs": 15
        },
        {
          "stage": "choose-form",
          "elapsedMs": 1
        }
      ]
    },
    "chart": {
      "kind": "horizontal-bar",
      "source": "Halcyon — onboarding_applications, branches",
      "caption": "Rejection rate by branch",
      "seriesKeys": [
        "rejection_rate"
      ],
      "categoryKey": "branch"
    },
    "kicker": "ONBOARDING APPLICATIONS · 35MS · 32 ROWS",
    "columns": [
      {
        "key": "branch",
        "type": "text",
        "label": "Branch"
      },
      {
        "key": "applications",
        "type": "number",
        "label": "Applications"
      },
      {
        "key": "rejected",
        "type": "number",
        "label": "Rejected"
      },
      {
        "key": "rejection_rate",
        "type": "percent",
        "label": "Rejection rate"
      }
    ],
    "filedAt": "2026-09-23T10:48:41.329Z",
    "related": [
      {
        "form": "table",
        "tables": [
          "onboarding_applications",
          "branches"
        ],
        "question": "How many applications has each branch taken?",
        "templateId": "applications-by-branch"
      },
      {
        "form": "line",
        "tables": [
          "onboarding_applications"
        ],
        "question": "How has the approval rate changed over time?",
        "templateId": "approval-rate-over-time"
      }
    ],
    "headline": "Preston Fishergate rejects the highest share of applications",
    "question": "Which branches have the highest rejection rate?",
    "standfirst": "Across **32** branches, rejection rates run from **8.7%** at Cambridge Parkside to **23.0%** at Preston Fishergate — a spread of **14.3%** against a bank-wide rate of **16.2%**.",
    "templateId": "branch-rejection-rate",
    "assumptions": [
      "Branches with fewer than 200 applications are excluded, so a handful of decisions cannot top the table.",
      "Rejection here is the bank declining an application — not Halcyon refusing a question."
    ],
    "formRationale": "A small number of named categories with long labels, so the bars run horizontally and stay readable."
  }
}
```
