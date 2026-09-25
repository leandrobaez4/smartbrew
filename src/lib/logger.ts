import { Prisma, PrismaClient } from '@prisma/client';
import { persistAlertFromSystemEvent } from './alerts';

const prisma = new PrismaClient();

type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export async function logSystemEvent(level: LogLevel, source: string, message: string, details?: unknown) {
  try {
    await prisma.systemLog.create({
      data: {
        level,
        source,
        message,
        details: details == null
          ? Prisma.JsonNull
          : JSON.parse(JSON.stringify(details)) as Prisma.InputJsonValue,
      }
    });
    await persistAlertFromSystemEvent(level, source, message, details);
  } catch (error) {
    console.error('Failed to write system event:', error);
  }
}
