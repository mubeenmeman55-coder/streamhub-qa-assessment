@api @genres @emi
Feature: Genres and EMI endpoints

  Scenario: Genres list with counts matching the catalogue
    When I request the genres
    Then the response status is 200
    And the genre counts add up to the total number of titles

  Scenario Outline: EMI endpoint matches my own calculation - <principal> at <rate>% for <years> years
    When I request the EMI for principal <principal>, rate <rate> and years <years>
    Then the response status is 200
    And the EMI response matches my own calculation

    Examples:
      | principal | rate | years |
      | 2500000   | 10   | 10    |
      | 5000000   | 7.5  | 15    |
      | 1000000   | 12   | 5     |
      | 100000    | 0.1  | 1     |

  Scenario Outline: EMI endpoint rejects missing or invalid input - <case>
    When I send the raw request "/api/emi<query>"
    Then the response status is 400
    And the error response has code "<code>" and a helpful message

    Examples:
      | case                  | query                                 | code              |
      | no parameters         |                                       | MISSING_PARAMETER |
      | missing rate          | ?principal=100000&years=5             | MISSING_PARAMETER |
      | missing years         | ?principal=100000&rate=10             | MISSING_PARAMETER |
      | missing principal     | ?rate=10&years=5                      | MISSING_PARAMETER |
      | negative principal    | ?principal=-5&rate=10&years=5         | INVALID_PARAMETER |
      | zero rate             | ?principal=100000&rate=0&years=5      | INVALID_PARAMETER |
      | rate above maximum    | ?principal=100000&rate=51&years=5     | INVALID_PARAMETER |
      | non numeric principal | ?principal=lots&rate=10&years=5       | INVALID_PARAMETER |
      | fractional years      | ?principal=100000&rate=10&years=2.5   | INVALID_PARAMETER |
      | years above maximum   | ?principal=100000&rate=10&years=41    | INVALID_PARAMETER |
      | unsupported parameter | ?principal=100000&rate=10&years=5&x=1 | INVALID_PARAMETER |
