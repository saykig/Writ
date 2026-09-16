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

function declared_names(spec::Dict{String, Any}, kind::String)
    return [String(node["id"]) for node in spec["nodes"] if String(node["kind"]) == kind]
end

function validate_table_keys(spec::Dict{String, Any})
    chance_names = Set(declared_names(spec, "chance"))
    value_names = Set(declared_names(spec, "value"))
    probability_names = Set(String(name) for name in keys(spec["probabilities"]))
    utility_names = Set(String(name) for name in keys(spec["utilities"]))

    probability_names == chance_names || error(
        "Probability tables do not match declared chance nodes: declared=$(sort!(collect(chance_names))) supplied=$(sort!(collect(probability_names)))",
    )
    utility_names == value_names || error(
        "Utility tables do not match declared value nodes: declared=$(sort!(collect(value_names))) supplied=$(sort!(collect(utility_names)))",
    )
end

function build_structure(spec::Dict{String, Any})
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
    return diagram, node_information, node_states
end

function add_probability_table!(diagram, spec, node_information, node_states, name::String)
    raw_rows = spec["probabilities"][name]
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

function add_utility_table!(diagram, spec, node_information, name::String)
    raw_rows = spec["utilities"][name]
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

function build_diagram(
    spec::Dict{String, Any};
    chance_insertion_order::Union{Nothing, Vector{String}} = nothing,
    value_insertion_order::Union{Nothing, Vector{String}} = nothing,
)
    validate_table_keys(spec)
    diagram, node_information, node_states = build_structure(spec)

    declared_chance = declared_names(spec, "chance")
    declared_value = declared_names(spec, "value")
    chance_order = isnothing(chance_insertion_order) ? declared_chance : chance_insertion_order
    value_order = isnothing(value_insertion_order) ? declared_value : value_insertion_order

    Set(chance_order) == Set(declared_chance) || error("Chance insertion order is not a permutation of declared chance nodes")
    Set(value_order) == Set(declared_value) || error("Value insertion order is not a permutation of declared value nodes")

    for name in chance_order
        add_probability_table!(diagram, spec, node_information, node_states, name)
    end

    for name in value_order
        add_utility_table!(diagram, spec, node_information, name)
    end

    return diagram
end

function run_writ(case_path::AbstractString, result_path::AbstractString)
    spec = load_case(case_path)
    diagram = build_diagram(spec)
    strategy, expected_utility, status = solve_diagram(diagram)
    write_result(result_path, diagram, strategy, expected_utility, status; source = "writ-adapter")
    println("Writ adapter expected utility: $(expected_utility)")
end

if abspath(PROGRAM_FILE) == @__FILE__
    case_path = length(ARGS) >= 1 ? ARGS[1] : "case.json"
    result_path = length(ARGS) >= 2 ? ARGS[2] : "writ-result.json"
    run_writ(case_path, result_path)
end
