// Small, complete programs also used to check the model-facing contract.
export const blockExamples = {
  dashboard: `root = Page([shell])
shell = AppShell("Orbit", [{id:"main",label:"Workspace",items:[{id:"overview",label:"Overview",icon:"layout-dashboard"},{id:"customers",label:"Customers",icon:"users"}]}], "Overview", [metrics, report])
metrics = MetricCards([{id:"revenue",label:"Revenue",value:"$42,000",trend:"+12%"},{id:"customers",label:"Customers",value:"1,250",description:"Active accounts"}], "revenue")
report = DashboardSection([chart], "Revenue", "Monthly performance")
chart = BarChart(["Jan","Feb","Mar"], [Series("Revenue",[32,38,42])], "grouped")`,
  workspace: `root = Page([shell])
shell = AppShell("Studio", [{id:"work",label:"Workspace",items:[{id:"projects",label:"Projects",icon:"folder"},{id:"team",label:"Team",icon:"users"}]}], "Projects", [projects], {name:"Alex Morgan",detail:"Design team"})
projects = DashboardSection([Table([TableColumn("Project","string"),TableColumn("Status","string")], [["Website",Badge("Active","secondary")],["Mobile",Badge("Planning","outline")]])], "Recent projects")`,
  login: `root = Page([auth])
auth = AuthLayout("login", "Orbit", [form], "Welcome back", "Sign in to your workspace", "Contact your administrator for access.")
form = Form("login", Buttons([Button("Sign in",null,"default")]), [email,password])
email = FormControl("Email", Input("email","you@example.com","email",{required:true,email:true}))
password = FormControl("Password", Input("password","Your password","password",{required:true}))`,
  signup: `root = Page([auth])
auth = AuthLayout("signup", "Orbit", [form], "Create your account", "Start your next project")
form = Form("signup", Buttons([Button("Create account",null,"default")]), [name,email,password])
name = FormControl("Full name", Input("name","Your name","text",{required:true}))
email = FormControl("Email", Input("email","you@example.com","email",{required:true,email:true}))
password = FormControl("Password", Input("password","Choose a password","password",{required:true}))`,
  mixed: `root = Page([Heading("Customer overview","h1"), metrics, details])
metrics = MetricCards([{id:"accounts",label:"Accounts",value:"230"},{id:"growth",label:"Growth",value:"8%"}])
details = DashboardSection([Card([TextContent("Your team grew this month.")],"Team update"), dialog], "Activity", null, Buttons([Button("Refresh",null,"outline")]))
dialog = DialogBlock("View details","Account activity","Sample information",[TextContent("Twelve new accounts joined this month.")],"outline")`,
};
