# AI-Generated Patient Transfer Summary Review Platform

A clinical review platform designed to evaluate the accuracy, clarity, and usability of AI-generated patient transfer summaries through structured human feedback.

## Overview

Emergency departments frequently receive patient transfer notes containing critical clinical information that must be quickly understood by receiving physicians. However, transfer documentation can be lengthy, inconsistent, and difficult to process during time-sensitive situations.

This platform enables healthcare reviewers to compare original patient transfer documentation with AI-generated summaries and provide structured feedback through standardized review questions. The collected evaluations help assess whether AI-generated summaries accurately preserve important clinical details and could safely support emergency care workflows.

---

## Research Context

Developed as part of a medical AI research workflow, this platform supports the evaluation of AI-assisted clinical communication tools by combining automated summarization with human clinical review.

By creating a structured evaluation process, this system helps determine whether AI-generated summaries are accurate, reliable, and understandable enough to support physicians during patient transfers.

---

# Demo

## Reviewer Interface

![Reviewer Interface Demo](images/reviewer-interface-reviewer-page.gif)
The reviewer interface allows users to:

- View original patient transfer notes alongside AI-generated summaries
- Compare information between source documentation and generated summaries
- Evaluate summary quality through structured survey questions
- Provide feedback on accuracy, completeness, and usability

---

## Admin Dashboard

![Admin Dashboard Demo](images/reviewer-interface-admin-page.gif)

The administrator dashboard allows management of:

- Reviewer assignments
- Patient cases
- Review progress
- Evaluation workflows

---

# Key Features

## Patient Transfer Note Comparison

Reviewers can directly compare:

**Original Transfer Note**  
The source clinical documentation containing patient information and transfer details.

**AI-Generated Summary**  
A condensed version designed to help physicians quickly understand transferred patients.

This comparison allows reviewers to determine whether important clinical information is preserved while unnecessary complexity is reduced.

---

## Structured Clinical Evaluation

Each patient case includes survey-based questions evaluating:

- Accuracy of clinical information
- Completeness of important details
- Clarity and readability
- Potential usefulness in emergency medicine workflows
- Overall quality of AI-generated summaries

---

## Reviewer Workflow Management

The platform supports:

- Assigning patient cases to reviewers
- Tracking review completion
- Organizing reviewer feedback
- Creating structured evaluation datasets for AI improvement

---

# Technology Stack

## Frontend

- Next.js
- React
- TypeScript
- CSS Modules

## Backend

- Python
- FastAPI
- REST APIs

## Deployment

- Docker
- Docker Compose

---

# System Architecture

```
Patient Transfer Notes
          |
          v
AI-Generated Summary Model
          |
          v
Reviewer Evaluation Platform
          |
     ----------------
     |              |
Reviewer Feedback   Admin Dashboard
     |
     v
AI Model Evaluation & Improvement
```

---

# Running the Application

## Clone Repository

```bash
git clone https://github.com/Kornblith-Lab/reviewer-interface.git
cd reviewer-interface
```

## Run with Docker

```bash
docker compose build
docker compose up
```

The application will be available at:

Frontend:

```
http://localhost:3000
```

Backend:

```
http://localhost:8000
```

---

# Project Impact

This platform supports the evaluation of AI-generated clinical summaries before potential integration into healthcare environments.

By combining artificial intelligence with human oversight, the system helps determine whether generated summaries are:

- Accurate
- Reliable
- Understandable
- Clinically useful

The long-term goal is to improve how physicians access critical patient information during emergency transfers while maintaining safety through expert review and validation.