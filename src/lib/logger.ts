import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export async function logSystemEvent(level: LogLevel, source: string, message: string, details?: any) {
  try {
    await prisma.systemLog.create({
      data: {
        level,
        source,
        message,
        details: details ? JSON.parse(JSON.stringify(details)) : null
      }
    });
  } catch (error) {
    console.error('Failed to write to SystemLog:', error);
  }
}
