# Insight Graph

MASTER PROMPT – Build a Winning GraphRAG Enterprise Compliance Platform

You are an expert software architect, senior full-stack engineer, AI engineer, UI/UX designer, DevOps engineer, and hackathon mentor.

Your goal is to build a polished, production-quality hackathon project in 24 hours that can realistically win a national-level hackathon.

Objective

Build an Enterprise Compliance Intelligence Platform using GraphRAG.

The system should ingest multiple document types, extract entities and relationships, build a dynamic knowledge graph, perform vector search, combine graph retrieval with semantic retrieval, and answer compliance questions with citations while minimizing hallucinations.

The solution must be visually impressive, technically strong, and fully demoable.

⸻

Tech Stack

Frontend

Next.js 15
React
TypeScript
Tailwind CSS
shadcn/ui
Framer Motion
React Flow
Recharts

Backend

FastAPI
Python

Database

Neo4j
Qdrant

AI

Gemini 2.5 Pro
Gemini Embeddings

Document Processing

PyMuPDF
Pandas
Tesseract OCR
OpenAI Whisper

Deployment

Vercel
Railway

⸻

Features

Authentication

Simple login page

Professional enterprise branding

Dark mode

⸻

Dashboard

Modern dashboard showing

Number of uploaded files

Knowledge graph nodes

Relationships

Compliance score

Risk score

Recent uploads

Recent AI questions

Interactive analytics

⸻

Upload Module

Support

PDF

Excel

CSV

Images

Audio

Drag and drop interface

Progress bars

File preview

⸻

Processing Pipeline

After upload

Extract text

OCR if needed

Speech-to-text for audio

Table extraction

Normalize data

Store raw document

⸻

Entity Extraction

Use Gemini to extract

Person

Organization

Department

Policy

Law

Rule

Document

Amount

Date

Country

Vendor

Asset

Risk

Create relationships automatically.

Example

John

APPROVED

Invoice

Invoice

BELONGS_TO

Microsoft

Microsoft

REGULATED_BY

AML Policy

Return structured JSON.

⸻

Knowledge Graph

Store all entities inside Neo4j.

Store all relationships.

Support querying.

Visualize graph interactively.

Clicking any node should display

metadata

connected nodes

source document

page number

⸻

Vector Database

Chunk every document intelligently.

Generate embeddings.

Store

embedding

filename

page

chunk

metadata

inside Qdrant.

⸻

GraphRAG Pipeline

When user asks a question

Search vector database.

Search Neo4j.

Merge both contexts.

Rank evidence.

Pass only relevant information to Gemini.

Generate answer.

Return

answer

confidence

citations

reasoning

graph nodes involved

⸻

Hallucination Guard

If evidence confidence is below threshold

do NOT generate an answer.

Instead return

“I could not find enough supporting evidence.”

Never fabricate.

⸻

Citation System

Every answer must include

Source document

Page number

Extracted paragraph

Confidence score

Download source button

⸻

Chat Interface

Professional ChatGPT-like interface.

Streaming responses.

Typing animation.

Suggested prompts.

Conversation history.

⸻

Knowledge Graph Viewer

Interactive graph.

Zoom

Search

Highlight relationships

Expand nodes

Collapse nodes

Different colors for

People

Organizations

Policies

Departments

Risks

⸻

Compliance Dashboard

Show

Compliance score

Policy violations

Risk alerts

Top risky departments

Recent findings

Timeline

⸻

Search

Global search

Search entities

Search documents

Search relationships

Search policies

⸻

AI Insights

Generate

Executive summary

Risk summary

Missing compliance

Recommendations

Top violations

Most connected entities

⸻

Analytics

Charts

Pie chart

Bar chart

Timeline

Heatmap

Relationship count

Entity distribution

⸻

API Structure

/auth

/upload

/process

/entities

/graph

/search

/chat

/analytics

/dashboard

⸻

Backend Structure

FastAPI

Routers

Services

Models

Repositories

Utils

LLM Service

Graph Service

Embedding Service

Retriever

⸻

Frontend Structure

components

pages

hooks

lib

services

context

styles

types

⸻

UI Style

Apple

Linear

Vercel

Notion

Enterprise SaaS

Rounded cards

Blur glassmorphism

Beautiful gradients

Professional animations

Responsive

Modern typography

⸻

Security

Validate uploads

Sanitize filenames

Limit file sizes

Environment variables

API key protection

⸻

Folder Structure

Generate a clean enterprise folder structure.

Separate frontend and backend.

⸻

Code Quality

TypeScript everywhere.

Reusable components.

Proper naming.

Comments.

Error handling.

Loading states.

Skeleton loaders.

⸻

README

Generate

Installation

Architecture diagram

Tech stack

How GraphRAG works

How to run

Future improvements

Demo steps

⸻

Demo Flow

Upload multiple files
Processing animation
Entity extraction
Knowledge graph creation
Ask

“Which vendor violates AML policy?”

Graph highlights connected nodes
AI answers
Shows citations
Shows confidence
Displays source pages

⸻

Deliverables

Generate the project in logical phases.

Do not generate placeholder code.

Write production-quality code.

Finish one feature completely before moving to the next.

Ensure the application is fully runnable at every stage.

Whenever a library is needed, install it automatically and explain why.

Maintain clean architecture throughout the project.

The goal is to create a hackathon-winning project with outstanding UI, GraphRAG, Neo4j integration, citations, and a compelling live demo.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/30d0f760-c23d-4ee9-a0bf-738a8370d398).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
