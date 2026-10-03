# Vote amplification in a pooled masternode

**Status: internal explainer — not for publication.** This revision corrects the
2026-09-19 draft (`VOTE_AMPLIFICATION_EXPLAINER.pdf`). Every protocol claim now
carries a source; the CrowdNode mechanism is labelled **described, not
verified**, and the one line the draft called load-bearing is corrected.

All Dash Core citations are from tag `v24.0.0-rc.1`.

## The constraint that makes the feature necessary

A Dash masternode casts one vote per governance signal per proposal. The vote
belongs to the node's outpoint, it is one of three outcomes — `YES`, `NO` or
`ABSTAIN` (`src/governance/vote.h:22-27`) — and it cannot be divided. The
signals are `FUNDING`, `VALID`, `DELETE` and `ENDORSED`
(`src/governance/vote.h:32-38`); a node votes once per signal per object, and a
later vote replaces the earlier one (`src/governance/object.cpp:878-893`,
`mapCurrentMNVotes` holds a single instance per signal).

Voting power attaches to the node, not to the amount of DASH behind it — with
one fixed exception: the weight is set by the node's **type**, not by its
deposit. A Regular node carries 1,000 DASH and one vote; an Evo node carries
4,000 DASH and four votes (`src/evo/dmn_types.h:33-39`). A node funded by a
hundred people still has exactly one vote (or four), so a member holding ten
DASH out of a thousand has no natural way to express a tenth of a vote.

Without something on top of that rule, pooling funds means giving up governance
entirely. The node votes, the members do not.

## How pooled voting works — *described, not verified*

The mechanism below is how **CrowdNode** is *described* to have handled it.
**This session could not verify it.** CrowdNode's own help pages are
unreachable from here (the knowledge base root returns 404 and the live site
does not connect), the Wayback CDX API answered only HTTP 429 rate-limit pages
throughout 2026-10-03, and the availability API has no snapshot for any voting
path on `crowdnode.com` or `knowledge.crowdnode.io`. The fee article pinned
previously (`knowledge.crowdnode.io/en/articles/2225953`) covers **pricing
only** and says nothing about voting. Until a snapshot of a voting page is
pinned and quoted verbatim, treat the five options, the balance weighting and
the default below as *a description of CrowdNode's product*, not as a fact
about it.

Per that description, CrowdNode gave each member a preference per proposal,
chosen from **Yes, No, Abstain, Delegate and DoNothing**, weighted by the
member's balance in the pool.

Two of those options are easy to confuse and the difference is the whole
mechanism. **Delegate** means go with the crowd, so the member's weight is
added to whatever the pool's active voters decided. **DoNothing** means cast
nothing at all, so the weight is genuinely withheld.

The important part — and the part that is **unverified** — is which one applies
to a member who never touches the setting. The description asserts the default
is to go with the crowd, not to withhold, which makes silence weight handed to
the members who did vote. That assertion must stay labelled as a description
until sourced.

"The crowd" here means exactly those members. The pool tallies the people who
expressed a preference, and everyone else's balance is added to that result.

## What amplification means in practice — and what it costs

**The example depends on the unverified default.** In a pool where one member
expresses a preference and everyone else leaves the setting alone, *if* the
default really is Delegate, every untouched balance goes with the crowd — and
the crowd in this case is that single member. Their choice becomes the pool's
position, and the node votes accordingly: a holder of a single DASH has
directed the full vote of a thousand-DASH node. Under a DoNothing default the
same example collapses to the active member's own balance, which is why the
default is the load-bearing claim and why it must be pinned before any of this
is published.

The previous draft claimed "nothing else in this note depends on that wording."
**That was wrong**, and this section replaces it: the amplification example
depends on nothing else *more* than it depends on the default.

Read the same mechanism from the other side and it is a **capture vector**, not
just a participation bonus:

- Whoever shows up controls the node's entire vote. Turnout, not stake, decides
  governance — an attacker can join cheaply and steer a 1,000-DASH vote when
  attention is low.
- Silent members' weight flowing to the loudest participants is exactly what a
  vote-buyer wants.
- The design choice is ours to make and must be presented as a trade-off:
  **default Delegate** maximises participation and concentrates power;
  **default DoNothing** is safer and suppresses it; a per-proposal opt-in
  splits the difference at the cost of engagement. No option is neutral.

Amplification does hand a real vote to people who show up whatever the size of
their contribution, and governance participation in Dash has indeed been
limited to people who can fund a whole node. But an honest explainer names the
cost next to the benefit.

## Where proportional outcomes come from

One node cannot express a split. If the members divide seventy to thirty, a
single node still has to choose one side. A pool running several nodes can
approximate the split by assigning each node's vote to match the tally, so
seven of ten nodes vote yes and three vote no. Proportional representation is
therefore a property of operating a fleet of nodes, not of any arithmetic
applied to one of them.

(The draft's claim that CrowdNode's aggregate results "tracked the
network-wide vote closely" carried no source and is **dropped** from this
revision rather than asserted.)

## What changes when the pool is non-custodial

The mechanism carries over. Members express the same preferences, weighted by
the same balances the reward accounting already uses, and the pool's voting keys
are cast to match the tally across its nodes. A shared masternode has exactly
one voting key, and the protocol requires it to differ from every share's
refund and reward payee (`src/evo/providertx.cpp:132`,
`IsShareListVotingKeySafe`) — so the tally-to-vote step is a service the pool
operator builds, never a protocol feature.

**Verification is a design commitment, not a free property.** The draft said
member preferences and balances "live on Dash Platform where anyone can read
them." That is only true if the pool writes member preferences to Platform as
documents — which requires an identity, a contract, credits and a UI, and is a
product decision with real cost. Until that commitment is made and shipped, the
verification argument for non-custodial pools is aspirational and must not be
presented as automatic.

## Blockers to shipping any of this

- **Mainnet cannot register shared masternodes on `v24.0.0-rc.1` at all:**
  `DEPLOYMENT_V24.nStartTime = Consensus::BIP9Deployment::NEVER_ACTIVE // TODO`
  (`src/chainparams.cpp:213`). Testnet is scheduled for 2026-09-24 (line 413);
  no mainnet date exists and none may be invented.
- The CrowdNode voting description is unsourced (see above). Pin it before
  quoting any of it externally.

## Sources

| Claim | Source |
|---|---|
| outcomes NONE/YES/NO/ABSTAIN | `src/governance/vote.h:22-27` |
| signals FUNDING/VALID/DELETE/ENDORSED | `src/governance/vote.h:32-38` |
| one vote per node per signal, latest wins, weight by type | `src/governance/object.cpp:878-893` |
| Regular 1 vote / 1,000 DASH; Evo 4 votes / 4,000 DASH | `src/evo/dmn_types.h:33-39` |
| shared node: single voting key, distinct from share payees | `src/evo/providertx.cpp:132` |
| mainnet shared registration blocked | `src/chainparams.cpp:213` |
| CrowdNode five options / weighting / default | **NOT VERIFIED** — no reachable source, 2026-10-03 |
