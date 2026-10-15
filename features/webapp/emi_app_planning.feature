@ui @webapp
Feature: EMI calculator app - planning tools (lump-sum prepayment, cumulative chart, eligibility, print)

  Background:
    Given I open the EMI app

  # ---------- one-time prepayment ----------
  Scenario Outline: A one-time prepayment of <lump> after payment <month> shortens the loan
    When I enter loan amount "25,00,000", rate "10", tenure "10" "Years" with a one-time prepayment of "<lump>" after payment "<month>" and calculate
    Then the prepayment impact is shown
    And the interest saved and months saved match my own calculation
    And the dashboard interest and total payment reflect the prepayment

    Examples:
      | lump      | month |
      | 2,00,000  | 12    |
      | 5,00,000  | 36    |
      | 10,00,000 | 60    |

  Scenario: The prepayment month shows a bigger principal repayment in the monthly schedule
    When I enter loan amount "25,00,000", rate "10", tenure "10" "Years" with a one-time prepayment of "5,00,000" after payment "24" and calculate
    And I open the "Report" page of the app
    And I switch the report to "Monthly" for year "2028"
    Then payment 24 repays its normal principal plus the prepayment
    And the balance after payment 24 is lower by exactly the prepayment

  Scenario Outline: Invalid one-time prepayment is rejected - <case>
    When I enter loan amount "25,00,000", rate "10", tenure "10" "Years" with a one-time prepayment of "<lump>" after payment "<month>" and calculate
    Then the "<field>" field shows the error "<message>"

    Examples:
      | case             | lump      | month | field      | message                                                   |
      | negative         | -1000     | 12    | lump       | One-time prepayment must be zero or a positive number.    |
      | above the loan   | 30,00,000 | 12    | lump       | One-time prepayment cannot be more than the loan amount.  |
      | month zero       | 1,00,000  | 0     | lump-month | Prepayment month must be a whole number between 1 and 120. |
      | month too late   | 1,00,000  | 121   | lump-month | Prepayment month must be a whole number between 1 and 120. |
      | fractional month | 1,00,000  | 2.5   | lump-month | Prepayment month must be a whole number between 1 and 120. |

  Scenario: The share link keeps the one-time prepayment
    When I enter loan amount "25,00,000", rate "10", tenure "10" "Years" with a one-time prepayment of "5,00,000" after payment "36" and calculate
    And I copy the share link
    And I open the share link
    Then the prepayment impact is shown
    And the interest saved and months saved match my own calculation

  # ---------- cumulative chart ----------
  Scenario: The chart can show cumulative principal and interest instead of yearly bars
    When I enter loan amount "25,00,000", rate "10", tenure "10" "Years" and calculate
    And I switch the chart to the cumulative view
    Then the cumulative chart has one point per year for principal and for interest
    And the cumulative totals equal the loan amount and total interest
    And the cumulative lines never decrease
    And the yearly bars are not shown
    When I switch the chart back to yearly bars
    Then the bar chart is visible with one stacked bar per calendar year

  # ---------- eligibility ----------
  Scenario Outline: Eligibility - an EMI of <budget> at <rate>% for <years> years
    When I open the "Eligibility" page of the app
    And I check eligibility for an EMI of "<budget>" at "<rate>" for "<years>" years
    Then the maximum loan matches my own calculation
    And that loan's EMI works out to the budget

    Examples:
      | budget   | rate | years |
      | 40,000   | 9    | 20    |
      | 25,000   | 8.5  | 15    |
      | 1,00,000 | 10   | 30    |
      | 10,000   | 12   | 5     |

  Scenario: The eligible loan can be loaded into the calculator
    When I open the "Eligibility" page of the app
    And I check eligibility for an EMI of "40,000" at "9" for "20" years
    And I use the eligible loan in the calculator
    Then the heading reads "Loan EMI dashboard"
    And the form is pre-filled with amount "44,45,000", rate "9" and tenure "20" "Years"
    And the EMI is just under the budget of 40000

  Scenario Outline: Eligibility rejects invalid input - <case>
    When I open the "Eligibility" page of the app
    And I check eligibility for an EMI of "<budget>" at "<rate>" for "<years>" years
    Then the eligibility form shows the error "<message>"

    Examples:
      | case           | budget | rate | years | message                                          |
      | tiny budget    | 100    | 9    | 20    | Monthly EMI must be between ₹500 and ₹1 crore.   |
      | rate zero      | 40,000 | 0    | 20    | Interest rate must be between 0.1% and 50%.      |
      | tenure too long| 40,000 | 9    | 41    | Tenure must be a whole number of years from 1 to 40. |
      | not a number   | abc    | 9    | 20    | Enter numbers for the EMI, rate and tenure.      |

  # ---------- print ----------
  Scenario: The report can be sent to the printer
    When I open the "Report" page of the app
    And I click Print report
    Then the browser print dialog was requested once
