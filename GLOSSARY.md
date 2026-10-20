# Island Sim

The language of the game: the islands, their people and the Mainland. Words the design spec already uses
(Outpost, Settlement, commuters, key staff, Goods flow, ...) keep the spec's meaning until they are listed here.

## Language

**Mainland help**:
A small grant of coins the Mainland sends on the morning ferry to an island that is stuck: no residents, too few
coins for one commuter's wage, and nothing it could sell or collect.
_Avoid_: bailout, loan, stipend

**Waiting for money**:
The condition of a building whose upkeep could not be paid; it keeps its workers but runs at reduced output until a
later payment succeeds.
_Avoid_: unpaid, stopped, broken

**Connector**:
The road a building lays when it is placed, from the building to the dock, reusing the roads already there and adding
only the missing tiles; paid together with the building.
_Avoid_: auto-road, access road, link

**Mirror**:
The client's copy of the open island, built from the server's full state and kept current by its updates; the
client reads it and never changes it.
_Avoid_: cache, local state, replica

**Moment**:
Something on the island that watch mode shows: a ferry that is due, a recent event worth seeing, or a busy spot on the
tour when nothing else is happening.
_Avoid_: shot, scene, highlight

**Ferry manifest**:
An island's record of its last ferry trip: who stepped off (newcomers, by the home they move into, and commuters) and
who boarded (leavers, by the home they left, and commuters going home). Each trip replaces it.
_Avoid_: passenger list, last ferry

**Carrier**:
A person walking goods along the roads from one building to another, holding them, before the island has trucks. A
shipment of 4 units or more goes by cart instead.
_Avoid_: porter, courier, delivery

**Cart**:
A hand cart pushed along the roads by one person, loaded with a shipment of 4 units or more; Outpost's vehicle, until
trucks arrive with Village.
_Avoid_: wagon, barrow, truck

**Work loop**:
What a workplace's workers visibly do through the day shift: fell trees and carry logs, work the field rows, row out
to fish. Animation only; it follows the sim's staffing and shift times and changes no numbers.
_Avoid_: job animation, task, routine

**Sale manifest**:
An island's record of its sales to the Mainland in the last game hour (tick, good and amount per sale), from which a
cargo boat leaves the pier for each sale.
_Avoid_: shipment (goods on the roads), sales log, export
