# components Package

## Overview
Reusable React UI components for navigation, status display, and layout.

## Components

**Navigation/** - Main navigation bar
- Responsive menu
- Active route highlighting
- Admin access control

**StatusHeader/** - Iron and status display
- Number formatting
- Color-coded status indicator
- Optional click handling

**Layout/** - Layout wrappers
- AuthenticatedLayout - Consistent layout for authenticated pages

**Root:**
- LoginPageComponent.tsx - Login/register form

## Usage
All authenticated pages use AuthenticatedLayout which includes Navigation and StatusHeader.
