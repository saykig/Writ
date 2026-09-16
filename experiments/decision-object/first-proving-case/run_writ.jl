using JSON3
using DecisionProgramming
include("engine_support.jl")

function parse_exact_number(value)
    text = String(value)
    if occursin("/", text)
        numerator, denominator = split(text, "/"; limit = 2)
        return parse(Float64, numerator) / parse(Float64, denominator)
    end
    return parse(Float64, text)
end

function string_vector(values)
    return [String(value) for value in values]
end

function load_case(path::AbstractString)
    return JSON3.read(read(path, String), Dict{String, Any})
end

function build_diagram(spec::Dict{String, Any})
    diagram = InfluenceDiagram()
    node_information = Dict{String, Vector{String}}()
    node_states = Dict{String, Vector{String}}()

    for raw_node in spec["nodes"]
        node = Dict{String, Any}(raw_node)
        name = String(node["id"])
        kind = String(node["kind"])
        information = string_vector(node["information"])
        node_information[name] = information

        if kind == "chance"
            states = string_vector(node["states"])
            node_states[name] = states
            add_node!(diagram, ChanceNode(name, information, states))
        elseif kind == "decision"
            states = string_vector(node["states"])
            node_states[name] = states
            add_node!(diagram, DecisionNode(name, information, states))
        elseif kind == "value"
            add_node!(diagram, ValueNode(name, information))
        else
            error("Unsupported node kind $(kind) for $(name)")
        end
    end

    generate_arcs!(diagram)

    for (raw_name, raw_rows) in spec["probabilities"]
        name = String(raw_name)
        information = node_information[name]
        states = node_states[name]
        table = ProbabilityMatrix(diagram, name)

        for raw_row in raw_rows
            row = Dict{String, Any}(raw_row)
            given = Dict{String, Any}(row["given"])
            values = Dict{String, Any}(row["values"])
            prefix = [String(given[parent]) for parent in information]
            for state in states
                table[prefix..., state] = parse_exact_number(values[state])
            end
        end

        add_probabilities!(diagram, name, table)
    end

    for (raw_name, raw_rows) in spec["utilities"]
        name = String(raw_name)
        information = node_information[name]
        table = UtilityMatrix(diagram, name)

        for raw_row in raw_rows
            row = Dict{String, Any}(raw_row)
            given = Dict{String, Any}(row["given"])
            prefix = [String(given[parent]) for parent in information]
            table[prefix...] = parse_exact_number(row["value"])
        end

        add_utilities!(diagram, name, table)
    end

    return diagram
end

case_path = length(ARGS) >= 1 ? ARGS[1] : "case.json"
result_path = length(ARGS) >= 2 ? ARGS[2] : "writ-result.json"
spec = load_case(case_path)
diagram = build_diagram(spec)
strategy, expected_utility, status = solve_diagram(diagram)
write_result(result_path, diagram, strategy, expected_utility, status; source = "writ-adapter")
println("Writ adapter expected utility: $(expected_utility)")
