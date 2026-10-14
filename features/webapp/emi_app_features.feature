@ui @webapp
Feature: EMI calculator app - prepayment, compare, export, saved scenarios, sharing

  Background:
    Given I open the EMI app

  # ---------- amount in words ----------
  Scenario Outline: The loan amount is spelled out in words - <amount>
    When I type "<amount>" in the loan amount field
    Then the amount in words reads "<words>"

    Examples:
      | amount      | words                                                      |
      | 25,00,000   | Twenty-five lakh rupees                                    |
      | 1,00,00,000 | One crore rupees                                           |
      | 12,34,567   | Twelve lakh thirty-four thousand five hundred sixty-seven rupees |
      | 50000       | Fifty thousand rupees                                      |

  # ---------- prepayment ----------
  Scenario Outline: An extra monthly payment shortens the loan and saves interest - <extra> extra
    When I enter loan amount "25,00,000", rate "10", tenure "10" "Years" with an extra monthly payment of "<extra>" and calculate
    Then the prepayment impact is shown
    And the interest saved and months saved match my own calculation
    And the dashboard interest and total payment reflect the prepayment
    And the bar chart spans only the years the shortened loan actually runs

    Examples:
      | extra  |
      | 5000   |
      | 10000  |
      | 50000  |

  Scenario: Without an extra payment there is no prepayment impact box
    When I enter loan amount "25,00,000", rate "10", tenure "10" "Years" and calculate
    Then the prepayment impact is not shown

  Scenario Outline: Invalid extra payment is rejected - <case>
    When I enter loan amount "25,00,000", rate "10", tenure "10" "Years" with an extra monthly payment of "<extra>" and calculate
    Then the "extra" field shows the error "<message>"

    Examples:
      | case          | extra     | message                                         |
      | negative      | -500      | Extra payment must be zero or a positive number. |
      | not a number  | lots      | Extra payment must be zero or a positive number. |
      | above amount  | 30,00,000 | Extra payment cannot be more than the loan amount. |

  Scenario: The final payment of a prepaid loan clears the balance exactly
    When I enter loan amount "25,00,000", rate "10", tenure "10" "Years" with an extra monthly payment of "10000" and calculate
    And I open the "Report" page of the app
    Then the schedule totals equal the prepayment principal and interest
    And the final closing balance is zero

  # ---------- compare ----------
  Scenario: Comparing two loans shows each measure and the difference
    When I open the "Compare" page of the app
    And I compare loan A "25,00,000" at "10" for "10" years with loan B "25,00,000" at "9" for "15" years
    Then every comparison figure matches my own calculation
    And the verdict says loan "A" is cheaper overall

  Scenario: The cheaper loan is identified when loan B wins
    When I open the "Compare" page of the app
    And I compare loan A "25,00,000" at "12" for "10" years with loan B "25,00,000" at "8" for "10" years
    Then every comparison figure matches my own calculation
    And the verdict says loan "B" is cheaper overall

  Scenario Outline: Compare rejects invalid input - <case>
    When I open the "Compare" page of the app
    And I compare loan A "<amount>" at "<rate>" for "<years>" years with loan B "25,00,000" at "9" for "15" years
    Then the comparison shows the error "<message>"

    Examples:
      | case          | amount    | rate | years | message                                                      |
      | rate too low  | 25,00,000 | 0    | 10    | Loan A: rate must be between 0.1% and 50%.                   |
      | years too big | 25,00,000 | 10   | 45    | Loan A: tenure must be a whole number of years from 1 to 40. |
      | amount tiny   | 500       | 10   | 10    | Loan A: amount must be between ₹10,000 and ₹100 crore.       |

  Scenario: The current loan can be copied into the comparison
    When I enter loan amount "50,00,000", rate "7.5", tenure "15" "Years" and calculate
    And I open the "Compare" page of the app
    And I use the current loan as loan A
    Then loan A in the comparison is "50,00,000" at "7.5" for "15" years

  # ---------- CSV export ----------
  Scenario: The filtered monthly schedule can be downloaded as CSV
    When I enter loan amount "25,00,000", rate "10", tenure "10" "Years" and calculate
    And I open the "Report" page of the app
    And I switch the report to "Monthly" for year "2030"
    And I download the schedule as CSV
    Then the file is named "emi-schedule-monthly.csv"
    And the CSV has a header and 12 monthly rows
    And the CSV interest adds up to that year's yearly interest

  # ---------- saved scenarios ----------
  Scenario: A scenario can be saved, survives a reload, restored and deleted
    When I enter loan amount "50,00,000", rate "7.5", tenure "15" "Years" and calculate
    And I save the scenario as "Home plan"
    Then the saved list shows "Home plan"
    When I reload the app
    Then the saved list shows "Home plan"
    When I enter loan amount "10,00,000", rate "12", tenure "5" "Years" and calculate
    And I load the saved scenario "Home plan"
    Then the form is pre-filled with amount "50,00,000", rate "7.5" and tenure "15" "Years"
    And the dashboard figures match my own calculation
    When I delete the saved scenario "Home plan"
    Then the saved list is empty

  Scenario: Saving needs a name and a valid loan
    When I save the scenario as ""
    Then the save error says "Give the scenario a name first."
    When I enter loan amount "0", rate "10", tenure "10" "Years" and calculate
    And I save the scenario as "Broken"
    Then the save error says "Fix the loan details before saving."

  # ---------- share link ----------
  Scenario: A share link restores the exact loan in a fresh page
    When I enter loan amount "50,00,000", rate "7.5", tenure "15" "Years" with an extra monthly payment of "2000" and calculate
    And I copy the share link
    Then the share link contains the loan details
    When I open the share link
    Then the form is pre-filled with amount "50,00,000", rate "7.5" and tenure "15" "Years"
    And the extra payment field shows "2000"
    And the prepayment impact is shown

  # ---------- theme ----------
  Scenario: The theme can be switched to dark and back
    When I toggle the theme
    Then the app is in "dark" mode
    When I toggle the theme
    Then the app is in "light" mode
