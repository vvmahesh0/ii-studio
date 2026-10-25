import { FLOW_REVISION, type Diagram } from "./contract.ts";
export const purchasePrompt =
  "An employee submits a purchase request. Incomplete requests return for revision. The manager approves or rejects it. Approved requests above ₹50,000 require finance approval; requests at or below that amount proceed directly to procurement. Finance may reject the request. Procurement places the order, and the employee confirms receipt.";
export const onboardingPrompt =
  "A user signs up with email and password. Invalid details return to the form. The user verifies their email, can resend verification, and chooses personal use or joining a team. Team users enter an invitation code; invalid codes can be retried. Both successful paths reach the dashboard.";
export const flowStarters = [
  { label: "Purchase approval", prompt: purchasePrompt },
  { label: "Account onboarding", prompt: onboardingPrompt },
  {
    label: "Refund request",
    prompt:
      "A customer requests a refund. Support checks whether the order is within 30 days. Requests outside that window are declined. Otherwise support checks whether the item was delivered: if not delivered, investigate the shipment and return to review; if delivered, approve the refund. Finance processes the refund and the customer is notified.",
  },
];
export const purchaseFixture: Diagram = {
  revision: FLOW_REVISION,
  title: "Purchase approval",
  direction: "DOWN",
  assumptions: [],
  nodes: [
    { id: "s", kind: "start", label: "Purchase needed" },
    { id: "submit", kind: "process", label: "Submit purchase request" },
    { id: "complete", kind: "decision", label: "Request complete?" },
    { id: "revise", kind: "process", label: "Revise request" },
    { id: "manager", kind: "decision", label: "Manager approves?" },
    { id: "amount", kind: "decision", label: "Amount above ₹50,000?" },
    { id: "finance", kind: "decision", label: "Finance approves?" },
    { id: "order", kind: "process", label: "Procurement places order" },
    { id: "receipt", kind: "process", label: "Employee confirms receipt" },
    { id: "done", kind: "end", label: "Purchase complete" },
    { id: "rejected", kind: "end", label: "Request declined" },
  ],
  edges: [
    ["s", "submit"],
    ["submit", "complete"],
    ["complete", "revise", "No"],
    ["revise", "submit"],
    ["complete", "manager", "Yes"],
    ["manager", "rejected", "No"],
    ["manager", "amount", "Yes"],
    ["amount", "finance", "Above ₹50,000"],
    ["amount", "order", "₹50,000 or less"],
    ["finance", "rejected", "No"],
    ["finance", "order", "Yes"],
    ["order", "receipt"],
    ["receipt", "done"],
  ].map((e, i) => ({
    id: `e${i}`,
    source: e[0],
    target: e[1],
    ...(e[2] ? { label: e[2] } : {}),
  })),
};
export const onboardingFixture: Diagram = {
  revision: FLOW_REVISION,
  title: "Account onboarding",
  direction: "DOWN",
  assumptions: [],
  nodes: [
    { id: "s", kind: "start", label: "Begin signup" },
    { id: "form", kind: "input-output", label: "Enter email and password" },
    { id: "valid", kind: "decision", label: "Details valid?" },
    { id: "send", kind: "process", label: "Send verification email" },
    { id: "verified", kind: "decision", label: "Email verified?" },
    { id: "resend", kind: "process", label: "Resend verification email" },
    { id: "choice", kind: "decision", label: "Personal use or team?" },
    { id: "code", kind: "input-output", label: "Enter invitation code" },
    { id: "codevalid", kind: "decision", label: "Invitation valid?" },
    { id: "done", kind: "end", label: "Reach dashboard" },
  ],
  edges: [
    ["s", "form"],
    ["form", "valid"],
    ["valid", "form", "No"],
    ["valid", "send", "Yes"],
    ["send", "verified"],
    ["verified", "resend", "Not yet / resend"],
    ["resend", "verified"],
    ["verified", "choice", "Yes"],
    ["choice", "done", "Personal"],
    ["choice", "code", "Team"],
    ["code", "codevalid"],
    ["codevalid", "code", "No"],
    ["codevalid", "done", "Yes"],
  ].map((e, i) => ({
    id: `e${i}`,
    source: e[0],
    target: e[1],
    ...(e[2] ? { label: e[2] } : {}),
  })),
};
