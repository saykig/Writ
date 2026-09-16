using DecisionProgramming
include("run_writ.jl")

spec = load_case("case.json")

# Deliberately preserve the source values while inserting the value tables in a wrong order.
# DecisionProgramming's default path utility consumes diagram.Y by insertion order, so this is a
# semantically corrupted lowering even though every individual table has the right shape and values.
value_order = ["V4", "V1", "V2", "V3"]
diagram = build_diagram(spec; value_insertion_order = value_order)
strategy, expected_utility, status = solve_diagram(diagram)
write_result(
    "order-corruption-result.json",
    diagram,
    strategy,
    expected_utility,
    status;
    source = "deliberately-order-corrupted-lowering",
)
println("Order-corrupted lowering expected utility: $(expected_utility)")
