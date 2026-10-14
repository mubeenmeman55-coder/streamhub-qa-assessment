@ui @webapp
Feature: EMI calculator app - dynamic behaviour (loan types, timing, financial year, drill-down, live results)
  Loan-type tabs, EMI at start/end of month, calendar vs financial year, expandable yearly rows,
  a balance line on the bar chart and results that update as you type or drag.

  Background:
    Given I open the EMI app

  # ---------- loan types ----------
  Scenario Outline: Choosing the <type> loan type loads its own starting values and slider range
    When I choose the "<type>" loan type
    Then the "<type>" loan type is selected
    And the form is pre-filled with amount "<amount>", rate "<rate>" and tenure "<tenure>" "Years"
    And the amount slider maximum is <maxAmount>
    And the dashboard figures match my own calculation

    Examples:
      | type          | amount    | rate | tenure | maxAmount |
      | Home loan     | 25,00,000 | 10   | 10     | 10000000  |
      | Personal loan | 5,00,000  | 12   | 3      | 3000000   |
      | Car loan      | 8,00,000  | 9    | 5      | 4000000   |

  # ---------- EMI timing ----------
  Scenario: Paying the EMI at the start of the month lowers the EMI and the total interest
    When I enter loan amount "25,00,000", rate "10", tenure "10" "Years" and calculate
    And I choose to pay the EMI at the start of the month
    Then the dashboard figures match my own calculation
    And the EMI equals the end-of-month EMI divided by one plus the monthly rate
    And the bars add up to the loan amount and the total interest

  Scenario: Start-of-month timing also holds for a prepaid loan
    When I enter loan amount "25,00,000", rate "10", tenure "10" "Years" and calculate
    And I choose to pay the EMI at the start of the month
    And I enter loan amount "25,00,000", rate "10", tenure "10" "Years" with an extra monthly payment of "10000" and calculate
    Then the EMI equals the end-of-month EMI divided by one plus the monthly rate
    And the prepayment impact is shown

  # ---------- calendar vs financial year ----------
  Scenario: Financial-year view groups April to March
    When I enter loan amount "25,00,000", rate "10", tenure "10" "Years" and calculate
    And I open the "Report" page of the app
    And I switch the year format to "Financial year (Apr-Mar)"
    Then the schedule rows are labelled as financial years starting "FY 2026-27"
    And the financial-year rows match my own calculation
    When I open the "Dashboard" page of the app
    Then the bar chart has one stacked bar per financial year

  Scenario: The year filter follows the chosen year format
    When I enter loan amount "25,00,000", rate "10", tenure "10" "Years" and calculate
    And I open the "Report" page of the app
    And I switch the year format to "Financial year (Apr-Mar)"
    And I switch the report to "Monthly" for year "2026"
    Then the schedule shows 3 monthly rows
    And the report summary says "3 months shown for FY 2026-27"

  # ---------- drill-down ----------
  Scenario: A yearly row expands into its months and collapses again
    When I enter loan amount "25,00,000", rate "10", tenure "10" "Years" and calculate
    And I open the "Report" page of the app
    And I expand the year "2030"
    Then the schedule shows 12 month rows under that year
    And the month rows add up to that year's yearly row
    And the yearly row count is still 10
    When I collapse the year "2030"
    Then no month rows are shown

  # ---------- balance line ----------
  Scenario: The bar chart draws the outstanding balance as a line
    When I enter loan amount "25,00,000", rate "10", tenure "10" "Years" and calculate
    Then the balance line is drawn with one point per year
    And the balance falls every year and ends at zero
    And the year-end balances match my own calculation

  # ---------- live results ----------
  Scenario: Results update as you type, without pressing Calculate
    When I type "40,00,000" in the loan amount field
    Then the EMI updates by itself to match my own calculation
    And the amount in words reads "Forty lakh rupees"

  Scenario: Dragging the amount slider updates the EMI live
    When I press ArrowRight 10 times on the loan amount slider
    Then the loan amount field shows "30,00,000"
    And the EMI updates by itself to match my own calculation

  Scenario: An invalid value while typing does not wipe the last good result
    When I type "40,00,000" in the loan amount field
    And the EMI updates by itself to match my own calculation
    And I type "abc" in the loan amount field
    Then the EMI still shows the figure for 40,00,000
