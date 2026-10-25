/** Hand-written, parser-checked samples. These are never presented as AI output. */
export const pricingSample = `root = Col([heading, intro, plans], 5)
heading = Title("A little room to grow.", "xl")
intro = Text("Simple plans for your next big idea. Cancel whenever you like.", "sm", "muted")
plans = Grid([starter, studio, scale], 3, 200, 4)
starter = Card([Title("Starter", "md"), Caption("For your first spark"), Title("$12", "2xl"), Caption("per month"), Divider(), List(["3 active projects", "1 workspace", "Community support"]), Button("Choose Starter", @ToAssistant("Selected Starter"), "outline", null, null, null, false, true)], "outline", 5, 4)
studio = Card([Badge("Most popular", "success"), Title("Studio", "md"), Caption("For ideas gaining momentum"), Title("$29", "2xl"), Caption("per month"), Divider(), List(["Unlimited projects", "5 collaborators", "Priority support"]), Button("Choose Studio", @ToAssistant("Selected Studio"), "solid", null, null, null, false, true)], "soft", 5, 4)
scale = Card([Title("Scale", "md"), Caption("For growing teams"), Title("$79", "2xl"), Caption("per month"), Divider(), List(["Unlimited collaborators", "Advanced analytics", "Dedicated support"]), Button("Choose Scale", @ToAssistant("Selected Scale"), "outline", null, null, null, false, true)], "outline", 5, 4)`;

export const statsSample = `root = Col([Title("Your business, at a glance.", "xl"), Text("A snapshot of this month. Illustrative data.", "sm", "muted"), metrics], 5)
metrics = Grid([revenue, customers, conversion], 3, 180, 4)
revenue = Card([Caption("Monthly revenue"), Title("$48,200", "2xl"), Badge("+12.8% this month", "success")], "outline", 6, 4)
customers = Card([Caption("Active customers"), Title("2,840", "2xl"), Badge("+8.2% this month", "success")], "outline", 6, 4)
conversion = Card([Caption("Conversion rate"), Title("4.6%", "2xl"), Badge("+0.9 points", "success")], "outline", 6, 4)`;

export const formSample = `root = Col([Title("Let's build something.", "xl"), Text("Tell us a little about your project.", "sm", "muted"), contact], 5)
contact = Form([name, email, message, send])
name = Input("", "Your name", "text", "Alex Morgan")
email = Input("", "Email", "text", "alex@example.com")
message = TextArea("", "What are you working on?", "A short description", 4)
send = Button("Send enquiry", @ToAssistant("Submit demo enquiry"), "solid")`;

export const chartSample = `root = Col([heading, overview], 5)
heading = Title("Revenue overview", "xl")
overview = Card([header, value, chart], "outline", 6, 4)
header = Row([Caption("Last six months"), Spacer(), Badge("+12.4%", "success")], 3, "center", "between")
value = Title("$184,500", "2xl")
chart = Chart("line", [{month: "May", revenue: 24500}, {month: "Jun", revenue: 27200}, {month: "Jul", revenue: 29800}, {month: "Aug", revenue: 32400}, {month: "Sep", revenue: 34100}, {month: "Oct", revenue: 36500}], "month", ["revenue"], "currency", "USD", false, 200)`;

export const starters = [
  {
    id: "study",
    label: "Study cards",
    prompt:
      "Create a language study section with a horizontal carousel of four French-to-English flip flashcards, a five-minute focus timer, and a How it works popover. Keep it compact.",
  },
  {
    id: "pricing",
    label: "Pricing plans",
    prompt:
      "Create a beautiful three-plan pricing section for a project management app, with features, prices, one recommended plan, and choose-plan buttons.",
  },
  {
    id: "stats",
    label: "Stats cards",
    prompt:
      "Create three stats cards for a subscription business: monthly revenue, active customers, and churn. Include realistic numbers and trend badges.",
  },
  {
    id: "chart",
    label: "Revenue chart",
    prompt:
      "Create a compact revenue widget with total revenue, a month-over-month trend badge, and a line chart for the last six months. Use sample data.",
  },
  {
    id: "form",
    label: "Contact form",
    prompt:
      "Create a clean contact form with name, email, project type, message, and a Send enquiry button. Keep it compact with clear labels.",
  },
  {
    id: "table",
    label: "Orders table",
    prompt:
      "Create a recent orders widget with a title, an order-count badge, and a table with four sample orders showing customer, product, amount, and payment status.",
  },
];

export const iconStatsSample = `root = Col([stats], 4)
stats = Grid([users, revenue, orders, conversion], 4, 180, 4)
users = Card([Row([Icon("users", "lg", "muted"), Col([Caption("Total users"), Title("18,240", "2xl")], 1)], 4, "center")], "outline", 5, 3)
revenue = Card([Row([Icon("credit-card", "lg", "muted"), Col([Caption("Total revenue"), Title("$64,120", "2xl")], 1)], 4, "center")], "outline", 5, 3)
orders = Card([Row([Icon("shopping-bag", "lg", "muted"), Col([Caption("Orders"), Title("1,482", "2xl")], 1)], 4, "center")], "outline", 5, 3)
conversion = Card([Row([Icon("trending-up", "lg", "muted"), Col([Caption("Conversion rate"), Title("4.6%", "2xl")], 1)], 4, "center")], "outline", 5, 3)`;

export const studySample = `root = Col([Title("Study break", "xl"), cards, tools], 5)
cards = Carousel([Flashcard("Bonjour", "Hello"), Flashcard("Merci", "Thank you"), Flashcard("Au revoir", "Goodbye")], 240, 4)
tools = Card([Timer(300, "Focus session"), Popover("How it works", [Text("Start the timer, then tap a card to reveal its translation.")]), Quote("Small steps, every day."), Math("a^2 + b^2 = c^2")], "outline", 5, 3)`;

export const modernStarters = [
  { id: "dashboard", label: "Dashboard", prompt: "Create a desktop subscription business dashboard using the curated AppShell, MetricCards and DashboardSection blocks. Include grouped sidebar navigation, four KPI cards, a monthly revenue chart and a recent customers table with sample data." },
  { id: "workspace", label: "Workspace", prompt: "Create a project workspace using AppShell with grouped navigation, a user summary and collapsible sidebar. Use DashboardSection for recent projects, a compact project creation form and a View details dialog. Keep content configurable and local." },
  { id: "auth", label: "Login / signup", prompt: "Create a polished login screen for a fictional productivity app using AuthLayout. Include required email and password fields, a Sign in button and a short supporting line. Keep authentication unconnected and use local validation." },
  ...starters.filter((starter) => starter.id !== "study"),
  {
    id: "settings",
    label: "Settings panel",
    prompt:
      "Create a desktop settings panel with General and Notifications tabs, name and email fields, notification switches, a plan selector, and a Save button. Keep interactions local.",
  },
];
