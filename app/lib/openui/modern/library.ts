"use client";
import { ModernImagePlaceholder } from "../shared/image-placeholder";
import { DataList } from "../local/data-list";
import { createLibrary } from "@openuidev/react-lang";
import {
  Page,
  Column,
  Row,
  Grid,
  Section,
  Card,
  Icon,
} from "./components/layout-components";
import { AppShell } from "./blocks/app-shell";
import { MetricCards } from "./blocks/metric-cards";
import { DashboardSection } from "./blocks/dashboard-section";
import { AuthLayout } from "./blocks/auth-layout";
// Content
import { Alert } from "./components/alert";
import { Avatar } from "./components/avatar";
import { ShadcnBadgeComponent } from "./components/badge";
import { CardHeader } from "./components/card-header";
import { CodeBlock } from "./components/code-block";
import { MarkDownRenderer } from "./components/markdown-renderer";
import { Progress } from "./components/progress";
import { Separator } from "./components/separator";
import { TextContent } from "./components/text-content";

// Charts
import {
  AreaChartCondensed,
  BarChartCondensed,
  LineChartCondensed,
  PieChartComponent,
  Point,
  RadarChartComponent,
  RadialChartComponent,
  ScatterChartComponent,
  ScatterSeries,
  Series,
  Slice,
} from "./components/charts";

// Forms
import { CheckBoxGroup, CheckBoxItem } from "./components/checkbox-group";
import { DatePicker } from "./components/date-picker";
import { Form } from "./components/form";
import { FormControl } from "./components/form-control";
import { Input } from "./components/input";
import { Label } from "./components/label";
import { RadioGroup, RadioItem } from "./components/radio-group";
import { Select, SelectItem } from "./components/select";
import { Slider } from "./components/slider";
import { SwitchGroup, SwitchItem } from "./components/switch-group";
import { TextArea } from "./components/textarea";

// Buttons
import { Button } from "./components/button";
import { Buttons } from "./components/buttons";

// Layout
import { Accordion, AccordionItemDef } from "./components/accordion";
import { Carousel } from "./components/carousel";
import { TabItem, Tabs } from "./components/tabs";

// Data Display
import { TableColumn, Table } from "./components/table";
import { Tag, TagBlock } from "./components/tag";

// Chat-specific

// New components
import { AlertDialogBlock } from "./components/alert-dialog-block";
import { CalendarBlock } from "./components/calendar-block";
import { DialogBlock } from "./components/dialog-block";
import { DrawerBlock } from "./components/drawer-block";
import { PaginationBlock } from "./components/pagination-block";
import { Blockquote, Heading, InlineCode } from "./components/typography";

export const library = createLibrary({
  id: "ii-modern-v3",
  root: "Page",
  components: [
    ModernImagePlaceholder,
    DataList,
    AppShell,
    MetricCards,
    DashboardSection,
    AuthLayout,
    // Root
    Page,
    Column,
    Row,
    Grid,
    Section,
    Card,
    Icon,
    CardHeader,
    // Content
    TextContent,
    MarkDownRenderer,
    Alert,
    ShadcnBadgeComponent,
    Avatar,
    CodeBlock,
    Progress,
    Separator,
    // Tables
    Table,
    TableColumn,
    // Charts (2D)
    BarChartCondensed,
    LineChartCondensed,
    AreaChartCondensed,
    RadarChartComponent,
    Series,
    // Charts (1D)
    PieChartComponent,
    RadialChartComponent,
    Slice,
    // Charts (Scatter)
    ScatterChartComponent,
    ScatterSeries,
    Point,
    // Forms
    Form,
    FormControl,
    Label,
    Input,
    TextArea,
    Select,
    SelectItem,
    DatePicker,
    Slider,
    CheckBoxGroup,
    CheckBoxItem,
    RadioGroup,
    RadioItem,
    SwitchGroup,
    SwitchItem,
    // Buttons
    Button,
    Buttons,
    // Follow-ups
    // Layout
    Tabs,
    TabItem,
    Accordion,
    AccordionItemDef,
    Carousel,
    // Data Display
    TagBlock,
    Tag,
    // Typography
    Heading,
    Blockquote,
    InlineCode,
    // Navigation
    PaginationBlock,
    // Overlays
    DialogBlock,
    AlertDialogBlock,
    DrawerBlock,
    // Calendar
    CalendarBlock,
  ],
  componentGroups: [
    {
      name: "Curated blocks",
      components: ["AppShell", "MetricCards", "DashboardSection", "AuthLayout"],
    },
    {
      name: "Screen layout",
      components: [
        "Page",
        "Column",
        "Row",
        "Grid",
        "Section",
        "Card",
        "CardHeader",
      ],
    },
    {
      name: "Content",
      components: [
        "ImagePlaceholder",
        "Heading",
        "TextContent",
        "MarkDownRenderer",
        "Badge",
        "Tag",
        "TagBlock",
        "Avatar",
        "CodeBlock",
        "InlineCode",
        "Blockquote",
        "Progress",
        "Alert",
        "Separator",
        "Icon",
      ],
    },
    {
      name: "Forms",
      components: [
        "Form",
        "FormControl",
        "Label",
        "Input",
        "TextArea",
        "Select",
        "SelectItem",
        "Slider",
        "DatePicker",
        "CheckBoxGroup",
        "CheckBoxItem",
        "RadioGroup",
        "RadioItem",
        "SwitchGroup",
        "SwitchItem",
        "Button",
        "Buttons",
      ],
    },
    {
      name: "Interactive",
      components: [
        "Tabs",
        "TabItem",
        "Accordion",
        "AccordionItem",
        "Carousel",
        "DialogBlock",
        "AlertDialogBlock",
        "DrawerBlock",
        "CalendarBlock",
        "PaginationBlock",
      ],
    },
    {
      name: "Tables and charts",
      components: [
        "Table",
        "TableColumn",
        "BarChart",
        "LineChart",
        "AreaChart",
        "PieChart",
        "RadarChart",
        "RadialChart",
        "ScatterChart",
        "Series",
        "Slice",
        "ScatterSeries",
        "Point",
      ],
    },
  ],
});
