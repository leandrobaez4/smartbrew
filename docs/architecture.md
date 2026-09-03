# Architecture

## Overview
This application is a monolithic Node.js application built with Next.js 15 (App Router), PostgreSQL, Prisma, and Redis (BullMQ).

## Flow
1. **Admin Panel**: Users log in to manage products and content drafts.
2. **PostgreSQL**: Stores state of products, drafts, media assets, and publications.
3. **Worker**: A background process running BullMQ consumes jobs from Redis to generate copy (OpenAI), render video (Remotion), and publish (Instagram).
4. **Public Landing**: A Next.js route `/productos` that displays active affiliate products.

## External Services
- **Mercado Libre**: Fetches product details.
- **OpenAI**: Generates structured JSON for captions and video content.
- **S3 / R2**: Stores the final MP4 video for Meta to access.
- **Instagram Platform API**: Publishes the media.
