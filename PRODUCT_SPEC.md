# EDOS POULTRY360

## Premium Poultry Farm Management, Farmer Network & Intelligence SaaS

### Product Name

**EDOS Poultry360**

### Tagline

**Manage Every Flock. Every Farmer. Every Decision.**

### Product Positioning

Build **EDOS Poultry360** as a premium, production-ready, multi-tenant Poultry Management, Farmer Network, Business Intelligence and Decision-Support SaaS platform designed for Kenya and scalable internationally.

This must NOT be a basic poultry CRUD application, Excel replacement, or simple farm record system.

The platform should combine:

* Poultry Farm Management
* Smallholder Farmer Management
* Commercial Farm Management
* Flock & Batch Management
* Layer Management
* Broiler Management
* Kienyeji/Indigenous Poultry Management
* Hatchery Management
* Feed Management
* Inventory
* Health & Vaccination
* Biosecurity
* Production Monitoring
* Sales & Customers
* Procurement & Suppliers
* Expenses & Financial Management
* Profitability Analysis
* Field Officer Management
* Farmer Network Management
* Cooperative/Aggregator Management
* Contract Farming
* Marketplace
* Notifications
* M-Pesa Payments
* SaaS Subscriptions
* Business Intelligence
* Artificial Intelligence
* Predictive Analytics
* Machine Learning
* Anomaly Detection
* Decision Support
* Offline/PWA functionality
* CMS and platform administration

The guiding principle is:

> **Simple input for the farmer. Powerful intelligence underneath.**

---

# 1. CORE PRODUCT MODEL

The platform must support the complete hierarchy:

```text
Organization / Tenant
        ↓
Region
        ↓
County
        ↓
Sub-County
        ↓
Ward
        ↓
Cluster
        ↓
Farmer
        ↓
Farm
        ↓
House
        ↓
Flock / Batch
        ↓
Daily Records
        ↓
Production / Health / Feed / Sales / Finance
        ↓
Analytics
        ↓
AI / ML Intelligence
        ↓
Alerts
        ↓
Recommendations
        ↓
Action
        ↓
Outcome
```

The platform must support both:

### Individual farmer

Example:

```text
Farmer
50–500 birds
1 farm
1–5 houses
simple mobile interface
```

and:

### Enterprise/network

Example:

```text
Organization
300 farmers
1,100 farms
3,800 houses
420,000 birds
multiple counties
field officers
farm managers
aggregators
veterinary teams
finance teams
management dashboards
```

The same platform must scale from a farmer managing **50 birds** to an organization managing **hundreds of thousands of birds**.

---

# 2. TECHNOLOGY STACK

Use:

* Next.js
* TypeScript
* React
* Tailwind CSS
* Supabase
* PostgreSQL
* Supabase Auth
* Supabase Storage
* Supabase Row Level Security
* Server Actions / API routes
* PWA
* Service Workers
* IndexedDB/local storage for offline functionality
* Modern charting library
* Responsive data tables
* Map integration
* Background processing architecture
* Notification architecture

Use a clean modular architecture.

The system should be deployable through Vercel or equivalent production infrastructure.

---

# 3. SUPABASE DATABASE REQUIREMENT

Use the existing:

**Supabase project: `edos_db`**

Do NOT modify, rename, delete, or interfere with unrelated existing EDOS tables.

All new poultry tables MUST use:

```text
poultryedos_
```

prefix.

Examples:

```text
poultryedos_tenants
poultryedos_users
poultryedos_farmers
poultryedos_farms
poultryedos_houses
poultryedos_flocks
poultryedos_daily_records
```

Create proper:

* primary keys
* foreign keys
* indexes
* unique constraints
* check constraints
* timestamps
* created_by
* updated_by
* soft deletion where appropriate
* audit fields
* tenant_id
* organization_id where required

Never create generic table names that can conflict with other EDOS systems.

---

# 4. MULTI-TENANT ARCHITECTURE

The application must be truly multi-tenant.

Support:

```text
EDOS Super Admin
       ↓
Tenant / Organization
       ↓
Tenant Admin
       ↓
Managers
       ↓
Farmers / Workers / Officers
```

Every tenant's operational data must be isolated.

Implement Supabase RLS rigorously.

A tenant must never be able to access another tenant's:

* farmers
* farms
* flocks
* financial data
* sales
* health records
* reports
* documents
* AI results
* subscriptions
* field activities

---

# 5. USER ROLES

Implement configurable RBAC.

Default roles:

```text
SUPER_ADMIN
TENANT_OWNER
TENANT_ADMIN
OPERATIONS_MANAGER
FARM_MANAGER
FARM_SUPERVISOR
FIELD_OFFICER
VETERINARY_OFFICER
ACCOUNTANT
PROCUREMENT_OFFICER
SALES_MANAGER
INVENTORY_MANAGER
DATA_ENTRY
FARMER
FARM_WORKER
VETERINARIAN
CONSULTANT
AUDITOR
CUSTOMER
BUYER
```

Permissions must be granular.

Examples:

```text
view_farm
create_farm
edit_farm
delete_farm
view_flock
create_flock
record_production
record_mortality
record_feed
view_financials
approve_expense
manage_inventory
manage_users
manage_subscriptions
view_ai_insights
manage_ai_settings
```

---

# 6. SMALLHOLDER FARMER — FIRST-CLASS USER

This is a CRITICAL requirement.

Do not design the platform only for large commercial farms.

A small farmer with:

```text
50 birds
100 birds
250 birds
500 birds
```

must be able to use EDOS Poultry360 comfortably from a mobile phone.

Create:

# SIMPLE FARMER MODE

The interface must hide unnecessary enterprise complexity.

The farmer's primary navigation should be approximately:

```text
Home
Record
Flock
Sales
Advice
```

Optional:

```text
More
```

---

# 7. FARMER HOME SCREEN

The farmer dashboard should immediately show:

```text
Good morning, John

Your Farm Today

🐔 Birds
🥚 Eggs
🌾 Feed
💰 Sales
⚠️ Alerts
```

Show:

* birds alive
* today's eggs
* today's mortality
* feed used
* today's sales
* estimated income
* estimated profit
* upcoming vaccination
* important alerts

Use cards and large touch targets.

Do not overload the farmer with graphs.

---

# 8. "RECORD TODAY" EXPERIENCE

Make this the most important action.

Example:

```text
RECORD TODAY

Birds alive
[ 245 ]

Deaths
[ 2 ]

Eggs collected
[ 198 ]

Feed used
[ 34 kg ]

Sales
[ KES 4,500 ]

[ SAVE TODAY'S RECORD ]
```

Target:

> A farmer should be able to record normal daily information in less than 60 seconds.

Use:

* numeric keypad
* dropdowns
* default values
* remembered selections
* quick actions
* voice notes where practical
* camera support
* offline save

---

# 9. PROGRESSIVE DATA ENTRY

Support:

### BASIC

```text
Birds
Deaths
Eggs
Feed
Sales
```

### STANDARD

Add:

```text
Water
Egg quality
Weights
Vaccination
Expenses
```

### ADVANCED

Add:

```text
Temperature
Humidity
Biosecurity
Feed batch
Detailed health
Medicine
House conditions
```

The farmer should not be forced to enter enterprise-level data.

---

# 10. ENGLISH + SWAHILI READY

Architect the interface for localization.

All labels should come from translation dictionaries.

Prepare:

```text
English
Swahili
```

The system should be designed to allow additional languages later.

Use farmer-friendly terminology.

Avoid unnecessarily technical terms.

---

# 11. OFFLINE FARMER MODE

Farmers may have unreliable connectivity.

Implement:

```text
Online
Offline
Syncing
Synced
Sync Failed
```

When offline:

* allow daily records
* allow mortality
* allow eggs
* allow feed
* allow sales
* allow expenses
* allow notes
* allow photos where feasible

Synchronize automatically when connectivity returns.

Prevent duplicate submissions.

Show sync status clearly.

---

# 12. FARMER DATA OWNERSHIP & VISIBILITY

Farmers should be able to view their own:

* farms
* flocks
* production
* mortality
* feed
* sales
* expenses
* profitability
* vaccination
* alerts
* recommendations

Field officers and managers should only see information permitted by their role and organizational assignment.

---

# 13. FARMER HELP / SUPPORT

Create:

**I NEED HELP**

Farmer can submit:

```text
Problem
Photo
Voice note
Location
Flock
House
Priority
```

Examples:

```text
Birds are dying
Egg production has dropped
Birds are not eating
Need vaccination reminder
Need market
Need feed
Need veterinary assistance
```

The system creates a support/field task.

---

# 14. FARMER ADVICE CENTER

Create a knowledge and advisory center containing CMS-managed content:

```text
Brooding
Feeding
Vaccination
Biosecurity
Housing
Egg handling
Disease warning signs
Marketing
Record keeping
Profitability
Water management
Poultry welfare
```

Content should be categorized by:

* layer
* broiler
* Kienyeji
* chick
* grower
* adult
* farmer experience level

AI may summarize or personalize information but must not invent veterinary facts.

---

# 15. FARM MANAGEMENT

Create farm profiles containing:

* farm name
* farmer
* county
* sub-county
* ward
* GPS
* farm type
* poultry type
* production system
* land size
* ownership
* farm photos
* contact details
* capacity
* biosecurity status
* water source
* electricity
* housing information
* market information

---

# 16. POULTRY TYPES

Support:

```text
Layers
Broilers
Kienyeji / Indigenous
Breeders
Chicks
Pullets
Mixed
Custom poultry types
```

Do not hard-code all production models.

Allow administrators to configure production systems.

---

# 17. HOUSE MANAGEMENT

Each farm can contain multiple houses.

Store:

* house name/code
* dimensions
* capacity
* ventilation
* flooring
* roofing
* equipment
* water system
* feeding system
* biosecurity
* photos
* current flock
* occupancy

Warn when stocking exceeds configured capacity.

---

# 18. FLOCK / BATCH MANAGEMENT

Every flock must have a unique batch identifier.

Capture:

* batch ID
* farm
* house
* poultry type
* breed
* source
* supplier
* placement date
* initial quantity
* current quantity
* age
* production phase
* purchase cost
* transfers
* mortality
* culling
* sales
* final outcome

Maintain a complete flock lifecycle.

---

# 19. LAYER MANAGEMENT

Support:

```text
Chick
Grower
Point of Lay
Laying
Peak
Post-Peak
Spent
```

Track:

* birds
* eggs
* trays
* pieces
* egg grades
* broken eggs
* dirty eggs
* cracked eggs
* rejects
* feed
* water
* mortality
* body weight
* egg weight

Automatically calculate:

```text
Hen Day Production
Egg mass
Eggs/bird
Feed/bird
Feed/dozen
Mortality %
Survival %
```

---

# 20. BROILER MANAGEMENT

Track:

* chicks placed
* mortality
* culling
* feed
* weekly weights
* sample size
* average weight
* weight gain
* ADG
* FCR
* uniformity
* market readiness
* expected harvest date
* actual harvest
* price/kg
* revenue
* cost/kg
* margin

Create a **Market Readiness Prediction**.

---

# 21. KIENYEJI / INDIGENOUS POULTRY

Support:

* free range
* semi-intensive
* intensive

Track:

* breeding
* eggs for incubation
* hatchability
* chicks
* mortality
* growth
* feed
* vaccination
* sales
* breeding stock
* flock composition

Allow administrators to configure local production models.

---

# 22. DAILY PRODUCTION

Daily records must support:

```text
Date
Farm
House
Flock
Birds alive
Mortality
Culls
Birds sold
Feed consumed
Water consumed
Eggs
Egg quality
Weight
Temperature
Humidity
Notes
```

Automatically calculate relevant KPIs.

Never require the user to manually calculate derived indicators.

---

# 23. MORTALITY INTELLIGENCE

Create mortality monitoring.

Classify:

```text
NORMAL
WATCH
WARNING
CRITICAL
```

Detect:

* sudden increases
* unusual mortality
* house-level anomalies
* flock-level anomalies
* repeated mortality patterns
* geographic clusters where sufficient data exists

Do NOT claim a disease exists simply because mortality increased.

Instead:

> "Mortality is above the farm's normal range. Veterinary review is recommended."

---

# 24. HEALTH MANAGEMENT

Record:

* symptoms
* observations
* suspected condition
* diagnosis
* treatment
* medication
* dosage
* treatment period
* veterinarian
* visit
* follow-up
* mortality
* outbreak/event
* laboratory result

AI must NEVER independently diagnose disease or prescribe medication.

AI may:

* identify unusual patterns
* flag abnormal mortality
* compare historical patterns
* suggest checking vaccination/biosecurity/feed/water records
* recommend veterinary review

---

# 25. VACCINATION

Create configurable vaccination schedules.

Store:

* vaccine
* target disease
* flock
* scheduled date
* actual date
* supplier
* batch number
* dose
* route
* administrator
* notes
* next due date

Automated reminders should be generated.

---

# 26. BIOSECURITY

Create a biosecurity module.

Track:

* footbath
* visitor control
* PPE
* cleaning
* disinfection
* rodents
* wild bird control
* dead bird disposal
* quarantine
* feed hygiene
* water sanitation
* staff compliance

Calculate:

**Biosecurity Score**

Allow configurable scoring.

Create alerts for repeated failures.

---

# 27. WATER MANAGEMENT

Track:

* water consumption
* source
* quality checks
* treatment
* cleaning
* abnormal consumption
* water availability

Use abnormal water consumption as a possible operational warning, not as automatic disease diagnosis.

---

# 28. FEED MANAGEMENT

Create feed inventory.

Track:

* feed type
* supplier
* batch
* purchase
* quantity
* cost
* expiry
* storage
* transfer
* consumption
* wastage
* closing stock
* flock allocation

Calculate:

```text
Feed/bird
Feed/kg gain
Feed/dozen eggs
FCR
Feed cost
```

Predict:

```text
Estimated days to stock-out
Expected consumption
Recommended reorder quantity
```

---

# 29. INVENTORY

Support:

* vaccines
* medicines
* feed
* equipment
* packaging
* cleaning materials
* farm supplies

Features:

* stock in
* stock out
* transfers
* adjustments
* batch tracking
* expiry
* low-stock alerts
* approval workflow

---

# 30. SALES

Support sales of:

```text
Eggs
Live birds
Processed birds
Spent layers
Chicks
Manure
Other poultry products
```

Capture:

* customer
* product
* quantity
* unit price
* discount
* total
* payment
* balance
* delivery
* invoice
* receipt

Payment methods:

```text
Cash
M-Pesa
Bank
Credit
Other
```

---

# 31. CUSTOMER / BUYER CRM

Customer types:

```text
Hotels
Restaurants
Schools
Hospitals
Supermarkets
Wholesalers
Retailers
Individuals
Aggregators
Processors
```

Track:

* contact
* orders
* purchase history
* credit
* outstanding balances
* preferred products
* delivery history

---

# 32. PROCUREMENT

Manage suppliers.

Track:

* supplier
* products
* prices
* purchase orders
* deliveries
* invoices
* payments
* outstanding balances
* supplier performance

---

# 33. EXPENSE MANAGEMENT

Categories:

```text
Chicks
Feed
Vaccines
Medicine
Labour
Transport
Electricity
Water
Rent
Equipment
Repairs
Veterinary services
Packaging
Marketing
Other
```

Support:

* receipts
* attachments
* approvals
* budgets
* recurring expenses

---

# 34. FINANCIAL INTELLIGENCE

Automatically calculate:

```text
Revenue
Expenses
Gross Profit
Net Profit
Cash Flow
Cost/bird
Cost/tray
Cost/egg
Cost/kg
Feed cost %
Labour cost %
Medicine cost %
Margin
ROI
Break-even
```

Do not require users to maintain manual spreadsheets.

---

# 35. BATCH PROFITABILITY

Every flock/batch should have a profitability view.

Example:

```text
Batch #BR-2026-001

Birds placed       1,000
Birds sold           945
Mortality              38
Feed cost       KES 185,000
Other costs      KES 72,000
Revenue         KES 310,000

Estimated Profit
KES 53,000
```

Allow drill-down to the underlying transactions.

---

# 36. FARMER PERFORMANCE SCORE

Create a configurable score based on:

* record completeness
* production
* mortality
* feed efficiency
* profitability
* vaccination compliance
* biosecurity
* flock performance
* consistency

Show:

```text
Excellent
Good
Needs Attention
Critical
```

Do not present arbitrary scores as scientific facts. Make methodology transparent and configurable.

---

# 37. FIELD OFFICER PLATFORM

Field officers should have:

```text
Assigned Farmers
Visits
Tasks
Alerts
Follow-ups
Maps
Farm History
Photos
Recommendations
```

They should be able to:

* visit farmer
* record GPS
* complete visit form
* take photos
* record observations
* create tasks
* submit recommendations
* follow up unresolved problems

Support offline operation.

---

# 38. FIELD VISIT WORKFLOW

Example:

```text
Assigned
↓
Traveling
↓
Visited
↓
Assessment
↓
Recommendation
↓
Action Required
↓
Follow-up
↓
Resolved
```

---

# 39. FARMER NETWORK MANAGEMENT

Organizations should be able to manage networks of farmers.

Dashboard:

```text
Total Farmers
Total Farms
Total Houses
Total Birds
Egg Production
Feed Consumption
Mortality
Sales
Expenses
Profitability
Alerts
```

Drill-down:

```text
Network
→ County
→ Sub-County
→ Ward
→ Farmer
→ Farm
→ House
→ Flock
→ Day
```

---

# 40. COOPERATIVES / AGGREGATORS

Support organizations managing groups of farmers.

Examples:

* cooperatives
* NGOs
* aggregators
* processors
* county programs
* contract farming organizations
* development programs

Allow:

* farmer registration
* aggregation
* targets
* production collection
* input distribution
* field officers
* performance tracking
* payments
* reports

---

# 41. CONTRACT FARMING

Optional module.

Support:

* contract
* farmer
* flock
* input allocation
* feed
* chicks
* vaccination
* target weight
* expected production
* purchase agreement
* delivery
* settlement
* performance

---

# 42. MARKETPLACE

Create an optional marketplace.

Farmers can:

* list eggs
* list birds
* list manure
* request feed
* find buyers
* view opportunities

Buyers can:

* publish demand
* specify quantity
* preferred location
* delivery requirements

Keep marketplace functionality modular.

---

# 43. FARMER FINANCING

Optional future module.

Support architecture for:

* input credit
* farmer financing
* repayment
* loan status
* input deductions

Do not make legal or regulatory assumptions.

Keep financial-provider integrations configurable.

---

# 44. M-PESA

Design a secure M-Pesa integration layer.

Support architecture for:

* STK Push
* C2B
* B2C where applicable
* callbacks
* payment verification
* reconciliation
* subscription payments
* transaction logs

Never store credentials in source code.

Use environment variables.

Example:

```text
MPESA_CONSUMER_KEY
MPESA_CONSUMER_SECRET
MPESA_PASSKEY
MPESA_SHORTCODE
MPESA_CALLBACK_URL
```

Design the integration so credentials and providers can be changed through secure configuration.

---

# 45. EDOS POULTRY360 SaaS SUBSCRIPTIONS

Create configurable subscription plans.

Example:

### STARTER

For small farmers.

### GROWTH

For growing farms.

### PROFESSIONAL

For commercial farms and organizations.

### ENTERPRISE

For large farmer networks, NGOs, cooperatives, aggregators and enterprise customers.

Limits should be configurable:

```text
farmers
farms
houses
flocks
users
field officers
storage
reports
AI usage
SMS
marketplace
```

---

# 46. SUBSCRIPTION ENGINE

Create:

```text
Trial
Active
Grace Period
Past Due
Suspended
Cancelled
Expired
```

Automated subscription workflow:

```text
Subscription created
↓
Payment
↓
Activated
↓
Renewal reminder
↓
Payment due
↓
Grace period
↓
Suspension
```

Do not delete tenant data after suspension.

---

# 47. NOTIFICATIONS

Support:

```text
In-app
Email
SMS
WhatsApp-ready architecture
Push notifications
```

Examples:

```text
Vaccination due
Feed running low
Mortality above normal
Subscription expiring
Payment received
Sales completed
Field visit scheduled
Farmer needs assistance
Task overdue
```

Allow notification preferences.

---

# 48. SMS ARCHITECTURE

Create an SMS provider abstraction.

Do not hard-code one provider.

Example interface:

```text
sendSMS()
sendBulkSMS()
getBalance()
getDeliveryStatus()
```

Allow future integration with Kenyan SMS providers.

Maintain:

* delivery logs
* failures
* retries
* opt-out settings
* message templates

---

# 49. AI / MACHINE LEARNING ENGINE

This is a major differentiator.

Do not build a fake chatbot and call it AI.

Build a genuine data-driven intelligence architecture.

Pipeline:

```text
Raw Data
↓
Validation
↓
Feature Engineering
↓
Training Dataset
↓
Model
↓
Prediction
↓
Confidence
↓
Explanation
↓
Recommendation
↓
Farmer/Manager Action
↓
Outcome
↓
Feedback
```

---

# 50. AI PREDICTIONS

Potential predictions include:

### Layer

* expected egg production
* production decline
* feed consumption
* feed requirement
* egg production trend
* revenue forecast
* profitability forecast

### Broiler

* expected weight
* growth trajectory
* market-ready date
* FCR trajectory
* mortality risk
* revenue forecast
* profitability

### Farm

* feed stock-out
* cash-flow pressure
* unusual mortality
* production anomalies
* expense anomalies
* demand forecasts

---

# 51. AI DATA REQUIREMENT

The system must NEVER invent intelligence where there is insufficient data.

Use levels:

```text
Level 1
Rule-based

Level 2
Historical farm trends

Level 3
Statistical forecasting

Level 4
Machine Learning

Level 5
Personalized predictive intelligence
```

If insufficient historical data exists:

> "Not enough farm data yet to make a reliable prediction."

Do not fabricate predictions.

---

# 52. AI CONFIDENCE

Every prediction should support:

```text
Prediction
Confidence
Data used
Model version
Generated date
Explanation
```

Example:

```text
Expected production:
2,850 eggs

Confidence:
82%

Why:
Production has been stable for the last 21 days.
Current flock age and historical production were considered.
```

---

# 53. AI DECISION CENTER

Create:

# WHAT NEEDS MY ATTENTION?

This should be the main intelligence screen.

Example:

```text
🔴 HIGH PRIORITY

Mortality in House 3 is above normal.

🟠 ATTENTION

Feed stock may run out in 4 days.

🟡 MONITOR

Egg production has declined for 5 consecutive days.

🟢 OPPORTUNITY

Buyer demand increased this week.
```

Every alert should explain:

```text
What happened?
Why does it matter?
What should I check?
What action is recommended?
```

---

# 54. AI ASSISTANT

Provide a tenant-aware AI assistant.

Questions:

```text
How is my farm performing?

Which flock is most profitable?

Why did egg production decline?

Which farm has the highest mortality?

How much feed will I need next week?

Which farmer needs field support?

Which batch should I sell?

What are my biggest expenses?
```

Responses must be grounded in actual tenant data.

Never expose another tenant's data.

---

# 55. AI SAFETY

AI is decision support.

It must not:

* diagnose disease definitively
* prescribe medication
* replace a veterinarian
* fabricate measurements
* fabricate farm records
* fabricate financial values

Use wording such as:

> "This pattern may warrant investigation."

and:

> "Consider veterinary review."

---

# 56. BENCHMARKING

Allow comparison against:

```text
Farm historical average
Flock historical average
Organization average
Breed benchmark
Production-system benchmark
Configured external benchmark
```

External benchmarks must be clearly identified as external/configured data.

Never present unsupported industry numbers as universal facts.

---

# 57. DATA QUALITY ENGINE

Detect:

* missing records
* duplicate records
* impossible values
* negative values
* sudden unexplained changes
* birds sold greater than birds available
* mortality greater than flock size
* feed consumption anomalies
* inconsistent dates

Create:

```text
Data Quality Score
```

and remediation workflows.

---

# 58. DASHBOARDS

Create different dashboards.

## Executive Dashboard

Show:

* farmers
* farms
* birds
* production
* mortality
* sales
* revenue
* expenses
* profit
* alerts
* trends

## Farmer Dashboard

Keep extremely simple.

## Farm Manager Dashboard

Detailed operational KPIs.

## Network Dashboard

Multi-farmer aggregation.

## Field Officer Dashboard

Assignments and alerts.

## Veterinary Dashboard

Health and vaccination patterns.

## Finance Dashboard

Revenue, expenses, profitability and cash flow.

---

# 59. REPORTING

Generate:

```text
Daily Farm Report
Weekly Farm Report
Monthly Farm Report
Flock Report
Layer Report
Broiler Report
Kienyeji Report
Feed Report
Health Report
Vaccination Report
Mortality Report
Production Report
Sales Report
Expense Report
Profitability Report
Farmer Statement
Field Officer Report
Biosecurity Report
Network Report
AI Intelligence Report
```

Allow:

* PDF
* Excel
* CSV
* print
* scheduled reports

---

# 60. FARMER STATEMENT

Each farmer should have a simple statement:

```text
Farmer
Period

Birds
Production
Feed
Sales
Expenses
Revenue
Estimated Profit
Outstanding Payments
```

---

# 61. MAPS

Provide map views for authorized users.

Show:

```text
Farm locations
Farmer clusters
Field officer assignments
Alerts
Production density
```

Never expose precise farmer locations to unauthorized users.

---

# 62. DOCUMENT MANAGEMENT

Use Supabase Storage.

Support:

* receipts
* invoices
* farm photos
* flock photos
* veterinary documents
* contracts
* farmer documents
* reports

Use signed URLs where appropriate.

---

# 63. REAL POULTRY VISUAL DESIGN

The platform should use premium, authentic poultry imagery.

Use:

* Kenyan/African poultry farms
* real chickens
* eggs
* poultry houses
* farmers
* feed
* farm operations

Avoid:

* cartoon chickens
* childish illustrations
* generic avatar-heavy interfaces
* excessive stock imagery
* fake AI-looking poultry photographs

Create centralized CMS-managed image slots so administrators can replace images without code changes.

---

# 64. DESIGN SYSTEM

Visual identity:

**EDOS Poultry360**

The design should feel:

* premium
* modern
* trustworthy
* agricultural
* technology-driven
* clean
* professional

Do not make it look like an old ERP.

Use:

* clean cards
* modern typography
* meaningful icons
* subtle animations
* strong hierarchy
* clear status colors
* excellent spacing
* mobile-first layouts

---

# 65. MOBILE-FIRST REQUIREMENT

Approximately 90% of users may interact through mobile devices.

Therefore:

**Mobile is the primary product. Desktop is the expanded experience.**

Support:

```text
320px
375px
390px
430px
768px
1024px
1440px+
```

No horizontal overflow.

Use:

* bottom navigation
* sticky actions
* large buttons
* touch-friendly controls
* swipeable cards where appropriate
* numeric keyboards
* camera access
* offline support

---

# 66. SIMPLE VS PROFESSIONAL MODE

Create two interface experiences.

### SIMPLE FARMER MODE

For smallholders.

### PROFESSIONAL MODE

For:

* commercial farmers
* managers
* cooperatives
* aggregators
* enterprise users

The backend remains unified.

The interface changes according to user role and preference.

---

# 67. CMS / SUPER ADMIN

Create a powerful platform administration area.

Super Admin should manage:

```text
Tenants
Users
Subscriptions
Plans
Modules
Feature Flags
Counties
Sub-counties
Wards
Poultry Types
Breeds
Vaccines
Feed Types
Medicine Categories
Expense Categories
Sales Categories
Benchmarks
Notification Templates
SMS Providers
Payment Providers
AI Settings
Knowledge Base
Content
Images
Announcements
Audit Logs
Support Tickets
System Settings
```

---

# 68. FEATURE FLAGS

Allow modules to be enabled/disabled per tenant.

Examples:

```text
AI
Marketplace
Field Officers
Contract Farming
Finance
M-Pesa
SMS
Advanced Reports
Veterinary
Inventory
```

---

# 69. AUDIT LOGGING

Log sensitive actions:

```text
Login
Logout
Create
Update
Delete
Approve
Reject
Payment
Subscription change
Role change
Financial modification
Health record modification
AI configuration
Data export
```

Record:

```text
user
tenant
action
table
record
old value
new value
IP where appropriate
timestamp
```

---

# 70. SECURITY

Implement:

* Supabase Auth
* RLS
* RBAC
* server-side validation
* API validation
* rate limiting
* secure sessions
* secure storage
* signed URLs
* input sanitization
* CSRF protection where applicable
* audit logging
* secure environment variables
* tenant isolation

Never expose:

* service role keys
* payment credentials
* AI API keys
* SMS credentials
* database credentials

to the browser.

---

# 71. DATA PRIVACY

Design the system around privacy by default.

Use minimum necessary data.

Restrict sensitive operational and financial information.

Implement:

* role-based visibility
* tenant isolation
* controlled exports
* audit logs
* secure deletion policies
* data retention configuration

---

# 72. PERFORMANCE

The platform must be designed for:

```text
10 farmers
100 farmers
1,000 farmers
10,000+ farmers
millions of daily records
```

Use:

* indexes
* pagination
* server-side queries
* aggregation
* materialized views where useful
* caching
* lazy loading
* background jobs
* optimized dashboards

Never load millions of records into the browser.

---

# 73. DATABASE INDEXING

Create indexes around:

```text
tenant_id
farmer_id
farm_id
house_id
flock_id
date
period
county_id
subcounty_id
ward_id
status
created_at
```

Use composite indexes for common analytics queries.

---

# 74. API ARCHITECTURE

Create clean service boundaries.

Example:

```text
/auth
/tenants
/farmers
/farms
/houses
/flocks
/production
/feed
/health
/vaccination
/biosecurity
/inventory
/sales
/customers
/suppliers
/expenses
/finance
/field
/reports
/notifications
/payments
/subscriptions
/ai
/analytics
/admin
```

---

# 75. DATABASE TABLES

Create an appropriate schema including, but not limited to:

```text
poultryedos_tenants
poultryedos_tenant_settings
poultryedos_users
poultryedos_roles
poultryedos_permissions
poultryedos_role_permissions
poultryedos_user_roles

poultryedos_regions
poultryedos_counties
poultryedos_subcounties
poultryedos_wards
poultryedos_clusters

poultryedos_farmers
poultryedos_farmer_profiles
poultryedos_farms
poultryedos_farm_locations
poultryedos_farm_photos
poultryedos_houses
poultryedos_house_equipment

poultryedos_poultry_types
poultryedos_breeds
poultryedos_flocks
poultryedos_flock_transfers
poultryedos_flock_events

poultryedos_daily_records
poultryedos_production_records
poultryedos_egg_records
poultryedos_weight_records
poultryedos_mortality_records

poultryedos_feed_types
poultryedos_feed_inventory
poultryedos_feed_purchases
poultryedos_feed_consumption
poultryedos_feed_transfers

poultryedos_health_events
poultryedos_vaccines
poultryedos_vaccination_schedules
poultryedos_vaccination_records
poultryedos_medications
poultryedos_veterinary_visits

poultryedos_biosecurity_checks
poultryedos_biosecurity_incidents

poultryedos_water_records

poultryedos_inventory_items
poultryedos_inventory_transactions
poultryedos_suppliers
poultryedos_purchase_orders

poultryedos_customers
poultryedos_sales
poultryedos_sale_items
poultryedos_payments
poultryedos_expenses
poultryedos_expense_categories

poultryedos_contracts
poultryedos_contract_batches

poultryedos_field_officers
poultryedos_field_assignments
poultryedos_field_visits
poultryedos_field_tasks

poultryedos_marketplace_listings
poultryedos_marketplace_orders

poultryedos_notifications
poultryedos_notification_templates
poultryedos_sms_logs

poultryedos_subscription_plans
poultryedos_subscriptions
poultryedos_subscription_transactions

poultryedos_payment_transactions
poultryedos_mpesa_transactions

poultryedos_ai_models
poultryedos_ai_features
poultryedos_ai_predictions
poultryedos_ai_alerts
poultryedos_ai_recommendations
poultryedos_ai_feedback

poultryedos_benchmarks
poultryedos_data_quality_checks
poultryedos_data_quality_issues

poultryedos_documents
poultryedos_audit_logs

poultryedos_cms_pages
poultryedos_cms_content
poultryedos_cms_media
poultryedos_knowledge_base
poultryedos_announcements

poultryedos_support_tickets
poultryedos_support_messages
```

Do not blindly create every table if a normalized design can achieve the same objective more efficiently. Avoid unnecessary duplication.

---

# 76. ANALYTICS DATA MODEL

Separate operational transactions from analytical aggregates.

Consider:

```text
Operational Tables
        ↓
Validated Events
        ↓
Aggregations
        ↓
Analytics Views
        ↓
Dashboards
        ↓
AI Features
```

Use PostgreSQL views/materialized views where appropriate.

---

# 77. AUTOMATION ENGINE

Create an automation framework capable of triggering:

```text
When mortality exceeds threshold
When feed stock is low
When vaccination is due
When subscription is expiring
When payment succeeds
When farmer submits help request
When field visit is overdue
When production declines
```

Actions may include:

```text
Create alert
Send SMS
Send email
Create task
Notify manager
Create field visit
Generate recommendation
```

---

# 78. FARMER COMMUNICATION

Design architecture for future:

```text
SMS
USSD
WhatsApp
Mobile App/PWA
Web
```

A farmer should eventually be able to interact without a full smartphone application.

Example future SMS:

```text
EGGS 185
DEATHS 2
FEED 35
SALES 4500
```

The system could interpret and store the record after validation.

USSD architecture should be modular and provider-independent.

---

# 79. VOICE INPUT

Where practical, support voice notes for farmers.

Example:

> "Leo nimekusanya trays sita, kuku wawili wamekufa na nimetumia kilo thelathini za chakula."

The system should eventually be able to convert structured voice input into records, but all extracted values must be displayed for confirmation before committing critical data.

---

# 80. FARMER GROWTH PATH

The system must support:

```text
50 birds
↓
100
↓
250
↓
500
↓
1,000
↓
5,000
↓
10,000+
```

As the farm grows, unlock more advanced functionality.

Do not force enterprise complexity on new farmers.

---

# 81. KNOWLEDGE BASE

Create a CMS-driven knowledge center.

Content types:

```text
Articles
Guides
FAQs
Videos
Checklists
Training material
Poultry calendars
Market information
```

Admins should manage all content without changing code.

---

# 82. SEO / PUBLIC WEBSITE

Create a public marketing website for EDOS Poultry360.

Pages:

```text
Home
Features
For Farmers
For Commercial Farms
For Cooperatives
For NGOs
For Aggregators
AI Intelligence
Pricing
Resources
Knowledge Base
About
Contact
Login
Register
```

Implement:

* SEO metadata
* OpenGraph
* structured data
* sitemap
* robots.txt
* canonical URLs
* semantic HTML
* optimized images
* fast loading
* mobile-first SEO

---

# 83. DASHBOARD UX PRINCIPLE

Every dashboard should answer:

```text
What is happening?
Why is it happening?
What requires attention?
What should I do next?
```

Avoid dashboards that only display numbers.

---

# 84. DECISION SUPPORT LOOP

The central EDOS Poultry360 intelligence loop should be:

```text
DATA
 ↓
INSIGHT
 ↓
ALERT
 ↓
RECOMMENDATION
 ↓
ACTION
 ↓
RESULT
 ↓
LEARNING
```

This should become one of the defining characteristics of the product.

---

# 85. REPORT EXPORT

Support:

```text
PDF
Excel
CSV
Print
```

Reports must respect user permissions and tenant boundaries.

---

# 86. IMPORT

Support:

```text
CSV
Excel
```

for migration of:

* farmers
* farms
* houses
* flocks
* historical production
* sales
* expenses
* feed
* health records

Provide:

```text
Download Template
Upload
Validate
Preview
Fix Errors
Import
Summary
```

Never partially import silently.

---

# 87. ERROR HANDLING

Use professional error handling.

Never show raw database errors to users.

Display:

```text
Something went wrong.
Please try again.
```

while logging technical details securely.

---

# 88. EMPTY STATES

Every module must have meaningful empty states.

Example:

> "No flocks yet. Add your first flock to start tracking production."

Do not show blank tables.

---

# 89. SEARCH

Global search should support authorized records such as:

```text
Farmer
Farm
Flock
House
Customer
Supplier
Batch
Invoice
```

Use server-side search.

---

# 90. TESTING

Implement:

### Unit tests

For:

* calculations
* mortality
* FCR
* profitability
* subscription logic
* permissions

### Integration tests

For:

* database
* Auth
* RLS
* payments
* notifications

### End-to-end tests

Test:

```text
Farmer registration
Farm creation
Flock creation
Daily record
Mortality
Egg production
Feed consumption
Sale
Expense
Profitability
Alert
AI recommendation
Subscription
Payment
```

---

# 91. ACCEPTANCE TEST

Create a demo tenant:

```text
500 farmers
1,100 farms
3,800 houses
420,000 birds
```

Populate realistic test data.

Verify:

* farmer login
* mobile recording
* offline recording
* synchronization
* flock tracking
* production
* mortality
* feed
* sales
* expenses
* profitability
* vaccination
* field visits
* network aggregation
* dashboards
* alerts
* AI insights
* reports
* tenant isolation

---

# 92. SMALLHOLDER ACCEPTANCE TEST

Create a farmer with:

```text
1 farmer
1 farm
2 houses
250 birds
```

The farmer must be able to:

1. Login
2. View farm
3. View flock
4. Record today's eggs
5. Record mortality
6. Record feed
7. Record a sale
8. View income
9. View estimated profit
10. Receive a vaccination reminder
11. Receive an alert
12. Request help
13. Use the system offline
14. Synchronize later

The entire process must be comfortable on a smartphone.

---

# 93. ENTERPRISE ACCEPTANCE TEST

Create an organization with:

```text
multiple counties
multiple field officers
hundreds of farmers
thousands of houses
hundreds of thousands of birds
```

Verify that management can drill down:

```text
Organization
→ County
→ Farmer
→ Farm
→ House
→ Flock
→ Day
```

without exposing unauthorized data.

---

# 94. MOBILE PERFORMANCE

Optimize for:

* low-end Android devices
* mobile Chrome
* unstable networks
* limited data bundles
* low bandwidth
* small screens

Avoid excessive animations and huge assets.

---

# 95. ACCESSIBILITY

Support:

* readable fonts
* adequate contrast
* keyboard navigation
* accessible forms
* ARIA labels
* screen-reader-friendly structure
* clear error messages
* large touch targets

---

# 96. DESIGN FOR TRUST

Farmers should understand why the system is making a recommendation.

Never hide important logic.

Example:

Instead of:

> "Risk Score: 87"

show:

> "Mortality increased from an average of 1–2 birds/day to 6 birds/day during the last three days. Check flock health and consider contacting a veterinary professional."

---

# 97. ADMIN CONFIGURATION

Do not hard-code:

* thresholds
* subscription prices
* notification templates
* vaccination schedules
* breeds
* production stages
* feed categories
* expense categories
* sales categories
* AI thresholds

Make these configurable where appropriate.

---

# 98. MODULAR ARCHITECTURE

Design the application so modules can be activated independently.

Core:

```text
Farm
Flock
Daily Records
```

Optional:

```text
Finance
Inventory
Field Officers
Marketplace
Contract Farming
AI
M-Pesa
SMS
Veterinary
```

---

# 99. FUTURE INTEGRATIONS

Architect for future integration with:

* IoT sensors
* temperature sensors
* humidity sensors
* automated feeders
* water meters
* weather APIs
* accounting systems
* government agricultural systems
* laboratory systems
* payment providers
* SMS providers
* WhatsApp APIs

Do not build unnecessary integrations during the first release, but ensure the architecture does not prevent them.

---

# 100. PRODUCTION-READY REQUIREMENT

Do not stop at generating pages.

The application must include:

```text
Database
Authentication
RLS
RBAC
Forms
Validation
Business logic
Calculations
Dashboards
Reports
Notifications
Subscriptions
Payments architecture
Offline functionality
CMS
Audit logging
AI architecture
Testing
Error handling
Security
Performance optimization
```

---

# 101. CODE QUALITY

Use:

* TypeScript strict mode
* reusable components
* reusable hooks
* service layers
* validation schemas
* clear folder structure
* typed database access
* centralized constants
* centralized configuration
* meaningful naming
* comments only where useful

Avoid:

* duplicated code
* giant components
* hard-coded business rules
* insecure client-side authorization
* exposing secrets
* unnecessary dependencies

---

# 102. DEVELOPMENT ORDER

Build in this order:

### PHASE 1

Architecture

```text
Next.js
Supabase
Auth
Database
RLS
RBAC
Tenant system
```

### PHASE 2

Core farm operations

```text
Farmers
Farms
Houses
Flocks
Daily records
```

### PHASE 3

Production

```text
Layers
Broilers
Kienyeji
Mortality
Feed
Water
Weights
```

### PHASE 4

Health

```text
Vaccination
Health
Veterinary
Biosecurity
```

### PHASE 5

Business

```text
Inventory
Procurement
Sales
Customers
Expenses
Finance
Profitability
```

### PHASE 6

Network

```text
Field officers
Visits
Tasks
Cooperatives
Aggregators
Contract farming
```

### PHASE 7

Platform

```text
CMS
Notifications
SMS
Subscriptions
M-Pesa
Reports
```

### PHASE 8

Intelligence

```text
Analytics
Anomaly detection
Forecasting
ML
AI assistant
Decision center
```

### PHASE 9

Optimization

```text
PWA
Offline
Performance
Accessibility
SEO
Security
Testing
```

---

# 103. FINAL PRODUCT EXPERIENCE

EDOS Poultry360 should feel like:

```text
Modern SaaS
+
Farm ERP
+
Farmer Network
+
Business Intelligence
+
AI Decision Support
```

not:

```text
Excel
+
CRUD forms
+
basic dashboard
```

---

# 104. CORE PRODUCT PHILOSOPHY

The platform should follow these principles:

### Principle 1

**Small farmers are first-class users.**

### Principle 2

**Complexity belongs in the backend, not in the farmer's face.**

### Principle 3

**Every record should create useful intelligence.**

### Principle 4

**Every important alert should lead to an action.**

### Principle 5

**AI must be grounded in real data.**

### Principle 6

**AI should support—not replace—farmers, managers and qualified veterinary professionals.**

### Principle 7

**Mobile-first is mandatory.**

### Principle 8

**Offline capability is essential for field users.**

### Principle 9

**Tenant isolation is non-negotiable.**

### Principle 10

**The platform must scale from 50 birds to hundreds of thousands of birds.**

---

# 105. MOST IMPORTANT USER JOURNEY

Design the entire system around this journey:

```text
FARMER
   ↓
RECORD
   ↓
SYSTEM UNDERSTANDS
   ↓
ANALYTICS
   ↓
INTELLIGENCE
   ↓
ALERT
   ↓
RECOMMENDATION
   ↓
FARMER ACTS
   ↓
RESULT RECORDED
   ↓
SYSTEM LEARNS
```

This is the heart of **EDOS Poultry360**.

---

# 106. FINAL INSTRUCTION TO THE DEVELOPMENT AGENT

Build EDOS Poultry360 as a **real production-grade commercial SaaS platform**, not a prototype.

Before writing large amounts of UI code:

1. Inspect the existing Supabase `edos_db` architecture where access is available.
2. Do not modify unrelated EDOS tables.
3. Design the `poultryedos_*` schema.
4. Implement RLS.
5. Implement authentication and RBAC.
6. Implement tenant isolation.
7. Build core workflows.
8. Build the mobile farmer experience.
9. Build professional/enterprise dashboards.
10. Implement calculations and business rules.
11. Implement offline support.
12. Implement reports.
13. Implement CMS.
14. Implement notifications.
15. Implement subscriptions.
16. Implement M-Pesa architecture.
17. Implement analytics.
18. Implement AI/ML architecture.
19. Test all workflows.
20. Optimize for production.

Do not claim a feature is complete merely because the UI exists.

A feature is complete only when:

```text
UI
+
Database
+
Validation
+
Business Logic
+
Security
+
Permissions
+
Error Handling
+
Testing
```

are implemented.

When a complex feature cannot be fully implemented in the current environment, create a clean production-ready abstraction/interface and clearly document the remaining integration point.

The final application should be visually premium, highly usable on mobile, commercially scalable, Kenyan-context aware, smallholder-friendly, enterprise-capable and intelligence-driven.

## FINAL PRODUCT NAME

# EDOS Poultry360

### Tagline

# Manage Every Flock. Every Farmer. Every Decision.
