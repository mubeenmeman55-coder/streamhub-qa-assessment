@ui @webapp
Feature: EMI calculator web app (Section A)
  As a borrower I want to enter loan details and see my EMI, a chart of where the money goes,
  and a payment schedule I can filter.

  Background:
    Given I open the EMI app

  Scenario: Dashboard loads with default loan and summary figures
    Then the page title contains "EMI Calculator"
    And the heading reads "Loan EMI dashboard"
    And the dashboard shows the monthly EMI, total interest, total payment and interest share
    And the form is pre-filled with amount "25,00,000", rate "10" and tenure "10" "Years"

  Scenario Outline: Calculated figures match my independent calculation - <amount> at <rate>% for <tenure> <unit>
    When I enter loan amount "<amount>", rate "<rate>", tenure "<tenure>" "<unit>" and calculate
    Then the dashboard figures match my own calculation

    Examples:
      | amount    | rate | tenure | unit   |
      | 25,00,000 | 10   | 10     | Years  |
      | 50,00,000 | 7.5  | 15     | Years  |
      | 10,00,000 | 12   | 60     | Months |
      | 1,00,000  | 0.1  | 1      | Years  |
      | 5,00,00,000 | 9.25 | 30   | Years  |

  Scenario Outline: Charts are visible and show valid non-zero data - <amount> at <rate>% for <tenure> years
    When I enter loan amount "<amount>", rate "<rate>", tenure "<tenure>" "Years" and calculate
    Then the app shows a visible pie chart
    And both pie segments are greater than zero and add up to 100 percent
    And the pie split matches the calculated principal and interest share
    And the bar chart is visible with one stacked bar per calendar year
    And every bar has principal and interest greater than zero
    And the bars add up to the loan amount and the total interest

    Examples:
      | amount    | rate | tenure |
      | 25,00,000 | 10   | 10     |
      | 50,00,000 | 7.5  | 15     |

  Scenario: Hovering a bar shows that year's figures
    When I enter loan amount "25,00,000", rate "10", tenure "10" "Years" and calculate
    And I hover the first bar
    Then the tooltip shows year 2027 with principal and interest matching my calculation

  Scenario: The EMI start month decides which calendar years appear
    When I enter loan amount "25,00,000", rate "10", tenure "10" "Years" starting "2027-06" and calculate
    Then the bar chart is visible with one stacked bar per calendar year
    And the chart spans 11 calendar years from 2027 to 2037

  Scenario: Moving the amount slider updates the amount field
    When I press End on the loan amount slider
    Then the loan amount field shows "1,00,00,000"

  Scenario: Report view lists the yearly schedule and its totals
    When I enter loan amount "25,00,000", rate "10", tenure "10" "Years" and calculate
    And I open the "Report" page of the app
    Then the heading reads "Amortisation report"
    And the schedule has one row per calendar year
    And the schedule totals equal the loan amount and total interest
    And the final closing balance is zero

  Scenario: Report filters narrow the schedule to one year of monthly rows
    When I enter loan amount "25,00,000", rate "10", tenure "10" "Years" and calculate
    And I open the "Report" page of the app
    And I switch the report to "Monthly" for year "2030"
    Then the schedule shows 12 monthly rows
    And the report summary says "12 months shown for 2030"
    And the monthly rows add up to that year's yearly interest

  Scenario Outline: Invalid input is rejected with a clear message - <case>
    When I enter loan amount "<amount>", rate "<rate>", tenure "<tenure>" "Years" and calculate
    Then the "<field>" field shows the error "<message>"
    And the dashboard still shows the previous EMI

    Examples:
      | case             | amount    | rate | tenure | field  | message                                           |
      | zero amount      | 0         | 10   | 10     | amount | Loan amount must be between ₹10,000 and ₹100 crore. |
      | amount not a number | lots   | 10   | 10     | amount | Enter the loan amount as a number.                |
      | rate too high    | 25,00,000 | 75   | 10     | rate   | Interest rate must be between 0.1% and 50%.       |
      | negative rate    | 25,00,000 | -5   | 10     | rate   | Interest rate must be between 0.1% and 50%.       |
      | tenure too long  | 25,00,000 | 10   | 41     | tenure | Tenure must be between 1 month and 40 years.      |
      | fractional tenure | 25,00,000 | 10  | 2.5    | tenure | Tenure must be a whole number.                    |
      | empty rate       | 25,00,000 |      | 10     | rate   | Enter the interest rate as a number.              |

  Scenario: Reset restores the defaults
    When I enter loan amount "50,00,000", rate "7.5", tenure "15" "Years" and calculate
    And I reset the form
    Then the form is pre-filled with amount "25,00,000", rate "10" and tenure "10" "Years"
    And the dashboard figures match my own calculation
