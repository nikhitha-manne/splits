# Splitwise-Style Expense Sharing App — Project Specification

## Product Goal
Build a production-ready, mobile-first expense sharing application similar to Splitwise with:
- Multi-user collaboration
- Nested groups
- Real-time balance calculation
- Multi-currency support
- Advanced splitting logic
- Bill upload with item-level splitting
- Manual payment tracking (no real payment APIs)

Target scale: <100 users, free tier, no daily limits.

---

## Core Rules (Non-Negotiable)
- Expenses CANNOT be deleted
- Expenses CAN be edited and must be marked as edited
- Balances update in real time
- All amounts must be normalized to each user’s default currency
- Any group member can add expenses
- No external payment APIs

---

## Users & Authentication
- Email + password authentication
- User profile includes:
  - Name
  - Email
  - Phone number
  - Profile photo
  - Default currency (mandatory)
  - Dietary preference (Veg / Non-Veg)

---

## Groups
- Users can belong to multiple groups
- Groups can be nested (parent-child)
- Roles:
  - Admin
  - Member
- Invite via email or shareable link

---

## Expenses & Splits
Supported split types:
- Equal
- Exact amounts
- Percentage
- Shares
- Item-based (from bill upload)

Expense properties:
- Title
- Description
- Amount
- Currency (changeable per expense)
- Paid by (one or more users)
- Participants
- Split configuration
- Edited flag + edited timestamp

---

## Multi-Currency
- Each user has a default currency
- Each expense has its own currency
- Converted values must be stored per user
- Conversion logic must be abstracted (API can be added later)

---

## Bill Upload & Item Splitting
- Upload bill image
- Extract items using OCR
- Each item has:
  - Name
  - Price
  - Veg / Non-Veg tag
- Non-veg items CANNOT be assigned to vegetarian users
- Item splits aggregate into final expense

---

## Settlements
- Manual payment tracking only
- Settlements can be reversed
- Settlements affect balances immediately

---

## Notifications
- In-app notifications only
- Notify on:
  - Expense added
  - Expense edited
  - Settlement completed

---

## UI / UX High Level
- Mobile-first
- Minimal, Splitwise-like
- Bottom navigation:
  - Home
  - Groups
  - Add Expense
  - Charts
  - Profile
