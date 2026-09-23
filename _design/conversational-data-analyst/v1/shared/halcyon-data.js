/* Halcyon — shared sample dataset.
 * FICTIONAL. Every institution, branch, customer and figure below is invented for a
 * design exercise. Shared verbatim by all three directions so the mocks can be compared
 * on design alone, never on the numbers.
 */
(function (root) {
  'use strict';

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* ---- Q1: monthly onboarding applications by customer segment (FY2025) ---- */
  var onboarding = {
    months: MONTHS,
    series: [
      { key: 'retail',    label: 'Retail',          values: [412, 438, 501, 476, 523, 559, 587, 544, 602, 641, 618, 674] },
      { key: 'sme',       label: 'SME',             values: [118, 131, 144, 139, 152, 167, 171, 163, 186, 198, 191, 214] },
      { key: 'corporate', label: 'Corporate',       values: [ 34,  29,  41,  38,  45,  47,  52,  44,  58,  61,  57,  66] },
      { key: 'private',   label: 'Private Banking', values: [ 12,  15,  14,  18,  17,  21,  19,  23,  22,  26,  24,  29] }
    ]
  };

  /* ---- Q2: top five customers by transaction value (FY2025) ---- */
  var topCustomers = {
    columns: [
      { key: 'rank',     label: '#',                align: 'right',  width: '3rem'  },
      { key: 'customer', label: 'Customer',         align: 'left'                   },
      { key: 'segment',  label: 'Segment',          align: 'left'                   },
      { key: 'branch',   label: 'Branch',           align: 'left'                   },
      { key: 'txns',     label: 'Transactions',     align: 'right', numeric: true   },
      { key: 'value',    label: 'Total value (GBP)', align: 'right', numeric: true  }
    ],
    rows: [
      { rank: 1, customer: 'Ardent Logistics Ltd',  segment: 'Corporate',       branch: 'Canary Wharf', txns: 4182, value: 18742900 },
      { rank: 2, customer: 'Pellworth Holdings',    segment: 'Private Banking', branch: 'Mayfair',      txns:  926, value: 14318450 },
      { rank: 3, customer: 'Quayside Freight Co',   segment: 'Corporate',       branch: 'Leith',        txns: 3517, value: 11204700 },
      { rank: 4, customer: 'Ravensmoor Estates',    segment: 'SME',             branch: 'Harrogate',    txns: 1488, value:  8973200 },
      { rank: 5, customer: 'Thorne & Vale Partners', segment: 'SME',            branch: 'Bristol Quay', txns: 2043, value:  7615880 }
    ]
  };

  /* Monthly transaction value for those same five customers, GBP millions. */
  var txnTrend = {
    months: MONTHS,
    series: [
      { key: 'ardent',     label: 'Ardent Logistics',  values: [1.21, 1.34, 1.49, 1.42, 1.58, 1.63, 1.71, 1.55, 1.68, 1.74, 1.66, 1.73] },
      { key: 'pellworth',  label: 'Pellworth Holdings', values: [0.98, 1.12, 1.07, 1.31, 1.18, 1.27, 1.22, 1.19, 1.24, 1.35, 1.28, 1.11] },
      { key: 'quayside',   label: 'Quayside Freight',  values: [0.81, 0.87, 0.94, 0.91, 0.99, 1.04, 1.02, 0.96, 1.01, 1.08, 0.97, 0.93] }
    ]
  };

  /* ---- Q3: branch rejection rates ---- */
  var branches = {
    columns: [
      { key: 'branch',    label: 'Branch',       align: 'left'                  },
      { key: 'apps',      label: 'Applications', align: 'right', numeric: true  },
      { key: 'rejected',  label: 'Rejected',     align: 'right', numeric: true  },
      { key: 'rate',      label: 'Rejection rate', align: 'right', numeric: true }
    ],
    rows: [
      { branch: 'Dalston Junction', apps: 1204, rejected: 289, rate: 24.0 },
      { branch: 'Leith',            apps:  876, rejected: 178, rate: 20.3 },
      { branch: 'Bristol Quay',     apps: 1531, rejected: 241, rate: 15.7 },
      { branch: 'Harrogate',        apps:  992, rejected: 131, rate: 13.2 },
      { branch: 'Canary Wharf',     apps: 2418, rejected: 264, rate: 10.9 },
      { branch: 'Mayfair',          apps:  614, rejected:  52, rate:  8.5 }
    ]
  };

  /* ---- Schema, as the router sees it ---- */
  var schema = [
    { table: 'customers',              rows: '48,201', columns: ['customer_id', 'legal_name', 'segment', 'branch_id', 'opened_at', 'risk_band'] },
    { table: 'branches',               rows: '32',     columns: ['branch_id', 'branch_name', 'region', 'opened_at'] },
    { table: 'onboarding_applications', rows: '31,886', columns: ['application_id', 'customer_id', 'branch_id', 'segment', 'submitted_at', 'decision', 'decided_at'] },
    { table: 'transactions',           rows: '2,914,330', columns: ['transaction_id', 'customer_id', 'posted_at', 'amount_gbp', 'direction', 'channel'] }
  ];

  /* ---- Canned pipeline runs, one per answer state ---- */
  var runs = {
    onboarding: {
      question: 'Show monthly onboarding applications by customer segment.',
      intent: 'aggregate · time-series · group-by',
      tables: ['onboarding_applications'],
      columns: ['submitted_at', 'segment', 'application_id'],
      sql: [
        'SELECT',
        "  date_trunc('month', submitted_at) AS month,",
        '  segment,',
        '  COUNT(application_id) AS applications',
        'FROM onboarding_applications',
        "WHERE submitted_at >= DATE '2025-01-01'",
        "  AND submitted_at <  DATE '2026-01-01'",
        'GROUP BY 1, 2',
        'ORDER BY 1, 2',
        'LIMIT 1000;'
      ].join('\n'),
      checks: [
        { label: 'Single statement',        status: 'pass', detail: 'One statement, no semicolon chaining' },
        { label: 'Read-only (SELECT)',      status: 'pass', detail: 'No INSERT / UPDATE / DELETE / DDL' },
        { label: 'Tables on allow-list',    status: 'pass', detail: 'onboarding_applications' },
        { label: 'Row limit enforced',      status: 'pass', detail: 'LIMIT 1000 appended by planner' },
        { label: 'Parameters bound',        status: 'pass', detail: '2 literals bound, 0 interpolated' }
      ],
      plan: 'Seq scan + hash aggregate · cost 412.8',
      rows: 48,
      ms: 74
    },
    customers: {
      question: 'Show the top five customers by transaction value.',
      intent: 'rank · join · aggregate',
      tables: ['transactions', 'customers', 'branches'],
      columns: ['amount_gbp', 'legal_name', 'segment', 'branch_name'],
      sql: [
        'SELECT',
        '  c.legal_name,',
        '  c.segment,',
        '  b.branch_name,',
        '  COUNT(t.transaction_id) AS txns,',
        '  SUM(t.amount_gbp)       AS total_value',
        'FROM transactions t',
        '  JOIN customers c ON c.customer_id = t.customer_id',
        '  JOIN branches  b ON b.branch_id   = c.branch_id',
        "WHERE t.posted_at >= DATE '2025-01-01'",
        '  AND t.direction = $1',
        'GROUP BY 1, 2, 3',
        'ORDER BY total_value DESC',
        'LIMIT 5;'
      ].join('\n'),
      checks: [
        { label: 'Single statement',     status: 'pass', detail: 'One statement' },
        { label: 'Read-only (SELECT)',   status: 'pass', detail: 'No write verbs present' },
        { label: 'Tables on allow-list', status: 'pass', detail: 'transactions, customers, branches' },
        { label: 'Row limit enforced',   status: 'pass', detail: 'LIMIT 5 from question' },
        { label: 'Parameters bound',     status: 'pass', detail: "$1 = 'debit' (bound, not interpolated)" }
      ],
      plan: 'Hash join ×2 + top-N sort · cost 9,214.0',
      rows: 5,
      ms: 318
    }
  };

  /* ---- Pipeline stage labels, shared by the thinking state ---- */
  var stages = [
    { key: 'parse',    label: 'Parse question',   detail: 'Intent: aggregate · time-series · group-by' },
    { key: 'route',    label: 'Route to tables',  detail: 'onboarding_applications · 4 of 22 columns' },
    { key: 'generate', label: 'Generate SQL',     detail: 'Planner draft, parameters bound' },
    { key: 'validate', label: 'Validate',         detail: '5 safety checks' },
    { key: 'execute',  label: 'Execute read-only', detail: 'Role halcyon_ro · 5s timeout' },
    { key: 'render',   label: 'Choose form',      detail: 'Time-series + category → grouped bars' }
  ];

  /* ---- Number formatting, shared so all three mocks read identically ---- */
  function gbp(n) {
    if (n >= 1e6) return '\u00a3' + (n / 1e6).toFixed(2) + 'm';
    if (n >= 1e3) return '\u00a3' + (n / 1e3).toFixed(1) + 'k';
    return '\u00a3' + n;
  }
  function num(n) { return n.toLocaleString('en-GB'); }
  function pct(n) { return n.toFixed(1) + '%'; }

  root.HALCYON = {
    months: MONTHS,
    onboarding: onboarding,
    topCustomers: topCustomers,
    txnTrend: txnTrend,
    branches: branches,
    schema: schema,
    runs: runs,
    stages: stages,
    fmt: { gbp: gbp, num: num, pct: pct }
  };
})(window);
