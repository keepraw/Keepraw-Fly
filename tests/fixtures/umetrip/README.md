# Fictional Umetrip-shaped XLS fixtures

These BIFF8 workbooks contain independently invented dates, flight numbers,
routes, ticket numbers and passenger text. No personal export or renamed real
record is included. They are regression inputs, not a claim that every Umetrip
version uses this layout.

`generate.py` uses **xlwt 1.3.0** as an independent writer so the fixed binary
fixtures are not produced by the SheetJS parser used in the app. xlwt is only
needed for regeneration and is not an application dependency:

```sh
python -m pip install --target /tmp/umetrip-fixture-tools xlwt==1.3.0
PYTHONPATH=/tmp/umetrip-fixture-tools python tests/fixtures/umetrip/generate.py
```

- `standard.xls`: one fictional used flight; consumed by the adapter unit tests
  and browser tests.
- `review.xls`: changed header position, extra passenger column, two segments
  sharing a ticket, exact/possible duplicates, OPEN and refunded rows; consumed
  by browser tests.
- `invalid.xls`: an unresolvable airport plus a valid row; consumed by browser
  tests to prove that an error prevents all writes.
- `formula.xls`: an actual BIFF8 formula in a required clock cell; consumed by
  unit tests to ensure that formula cells are rejected.
- `many-issues.xls`: 25 fictional rows with unknown airports; consumed by browser
  tests to verify that every diagnostic can be revealed in bounded batches.

Unit tests additionally generate layout, cell-type and status variants in memory.
