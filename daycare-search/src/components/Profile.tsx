import { CORE_CRITERIA, CRITERION_LABEL, type CriterionId, type School, type Weights } from '../lib/types'
import { fmtScore } from '../lib/rank'

export function Profile({ school, weights }: { school: School; weights: Weights }) {
  const live = CORE_CRITERIA.filter((id) => weights[id] > 0)
  const maxW = Math.max(...live.map((id) => weights[id]), 1)
  return (
    <div className="profile" aria-hidden="true">
      {live.map((id) => {
        const score = school.scores[id]
        const unknown = score == null
        const h = unknown ? 0 : Math.max(2, (score / 100) * 100)
        const w = 4 + (weights[id] / maxW) * 10
        return (
          <span
            key={id}
            className={unknown ? 'bar unk' : 'bar'}
            style={{ height: unknown ? '100%' : `${h}%`, width: w }}
            title={`${CRITERION_LABEL[id as CriterionId]} ${unknown ? 'unknown' : fmtScore(score)}`}
          />
        )
      })}
    </div>
  )
}
