using DecisionProgramming
include("engine_support.jl")

const N = 4
diagram = InfluenceDiagram()
add_node!(diagram, ChanceNode("H1", [], ["ill", "healthy"]))

for i in 1:N-1
    add_node!(diagram, ChanceNode("T$i", ["H$i"], ["positive", "negative"]))
    add_node!(diagram, DecisionNode("D$i", ["T$i"], ["treat", "pass"]))
    add_node!(diagram, ValueNode("V$i", ["D$i"]))
    add_node!(diagram, ChanceNode("H$(i+1)", ["H$i", "D$i"], ["ill", "healthy"]))
end
add_node!(diagram, ValueNode("V4", ["H4"]))
generate_arcs!(diagram)

add_probabilities!(diagram, "H1", [0.1, 0.9])

X_T = ProbabilityMatrix(diagram, "T1")
X_T["ill", "positive"] = 0.8
X_T["ill", "negative"] = 0.2
X_T["healthy", "positive"] = 0.1
X_T["healthy", "negative"] = 0.9

X_H = ProbabilityMatrix(diagram, "H2")
X_H["ill", "treat", :] = [0.5, 0.5]
X_H["ill", "pass", :] = [0.9, 0.1]
X_H["healthy", "treat", :] = [0.1, 0.9]
X_H["healthy", "pass", :] = [0.2, 0.8]

for i in 1:N-1
    add_probabilities!(diagram, "T$i", X_T)
    add_probabilities!(diagram, "H$(i+1)", X_H)
    add_utilities!(diagram, "V$i", [-100.0, 0.0])
end
add_utilities!(diagram, "V4", [300.0, 1000.0])

strategy, expected_utility, status = solve_diagram(diagram)
write_result("direct-result.json", diagram, strategy, expected_utility, status; source = "direct-donor-baseline")
println("Direct donor expected utility: $(expected_utility)")
