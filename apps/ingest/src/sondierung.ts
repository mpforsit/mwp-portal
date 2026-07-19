// Bindeglied Abruf → Persistenz: sondiert eine Quelle und legt den
// (unveränderlichen) Snapshot ab. fetch ist über deps injizierbar.
import { sondiereSource, type FetchDeps, type SnapshotPayload } from './fetcher.js'
import { insertSnapshot } from './snapshots-repo.js'

export const runSondierung = async (
  sourceId: string,
  url: string,
  deps?: FetchDeps,
): Promise<SnapshotPayload> => {
  const payload = await sondiereSource(url, deps)
  await insertSnapshot(sourceId, payload)
  return payload
}
