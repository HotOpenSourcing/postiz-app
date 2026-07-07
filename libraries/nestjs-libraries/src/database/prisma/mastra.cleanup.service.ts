import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from './prisma.service';

/**
 * Mastra table cleanup service.
 *
 * The mastra_* tables (messages, threads, ai_spans, scorers, evals) grow
 * indefinitely because Mastra does not ship a built-in TTL mechanism.
 * After months of use these tables can become very large and slow down queries.
 *
 * Retention policy:
 *  - mastra_messages / mastra_threads / mastra_resources: 30 days
 *  - mastra_ai_spans (telemetry/tracing): 7 days
 *  - mastra_scorers / mastra_evals: 30 days
 */
@Injectable()
export class MastraCleanupService {
  private readonly logger = new Logger(MastraCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 3 * * *') // Run at 03:00 UTC every day
  async cleanupMastraTables() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    try {
      // Messages older than 30 days
      const deletedMessages = await this.prisma.$executeRaw`
        DELETE FROM mastra_messages WHERE "createdAt" < ${thirtyDaysAgo}
      `;

      // Threads older than 30 days (only if they have no recent messages)
      const deletedThreads = await this.prisma.$executeRaw`
        DELETE FROM mastra_threads
        WHERE "createdAt" < ${thirtyDaysAgo}
          AND id NOT IN (
            SELECT DISTINCT thread_id FROM mastra_messages
            WHERE "createdAt" >= ${thirtyDaysAgo}
          )
      `;

      // Resources older than 30 days
      const deletedResources = await this.prisma.$executeRaw`
        DELETE FROM mastra_resources WHERE "createdAt" < ${thirtyDaysAgo}
      `;

      // AI spans (telemetry) older than 7 days — high volume, keep short
      const deletedSpans = await this.prisma.$executeRaw`
        DELETE FROM mastra_ai_spans WHERE "createdAt" < ${sevenDaysAgo}
      `;

      // Scorers older than 30 days
      const deletedScorers = await this.prisma.$executeRaw`
        DELETE FROM mastra_scorers WHERE "createdAt" < ${thirtyDaysAgo}
      `;

      this.logger.log(
        `Mastra cleanup complete — messages: ${deletedMessages}, threads: ${deletedThreads}, ` +
          `resources: ${deletedResources}, spans: ${deletedSpans}, scorers: ${deletedScorers}`
      );
    } catch (err) {
      this.logger.error('Mastra cleanup failed', err);
    }
  }
}
