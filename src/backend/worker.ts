import { Worker, NativeConnection } from '@temporalio/worker';
import * as workflows from './workflows';
import * as activities from './activities';

async function startWorker() {
  const connection = await NativeConnection.connect({
    address: (process.env.TEMPORAL_HOST || 'localhost') + ':' + (process.env.TEMPORAL_PORT || '7233'),
  });

  const worker = await Worker.create({
    connection,
    workflowsPath: require.resolve('./workflows'),
    activities,
    taskQueue: 'job-applier',
  });

  console.log('Worker started, listening on queue: job-applier');
  await worker.run();
}

startWorker().catch(console.error);
