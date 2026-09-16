using DecisionProgramming
using JuMP
using HiGHS
using JSON3

function solve_diagram(diagram::InfluenceDiagram)
    model, z, x_s = generate_model(
        diagram,
        model_type = "DP",
        positive_path_utility = true,
        probability_cut = false,
    )
    set_optimizer(model, optimizer_with_attributes(() -> HiGHS.Optimizer()))
    singlePolicyUpdate(diagram, model, z; x_s)
    optimize!(model)

    status = termination_status(model)
    status == JuMP.MOI.OPTIMAL || error("DecisionProgramming solve did not reach OPTIMAL: $(status)")

    strategy = DecisionStrategy(diagram, z)
    utility_distribution = UtilityDistribution(diagram, strategy)
    expected_utility = sum(
        Float64(u) * Float64(p) for (u, p) in zip(utility_distribution.u, utility_distribution.p)
    )

    return strategy, expected_utility, string(status)
end

function render_policy(diagram::InfluenceDiagram, strategy::DecisionStrategy)
    policy = Dict{String, Any}()

    for (decision_index, info_indices, local_strategy) in zip(
        strategy.D,
        strategy.I_d,
        strategy.Z_d,
    )
        decision_name = String(diagram.Names[decision_index])
        rows = Any[]

        information_states = isempty(info_indices) ? [()] : vec(collect(DecisionProgramming.paths(DecisionProgramming.get_values(diagram.S)[info_indices])))

        for information_state in information_states
            state_tuple = Tuple(information_state)
            chosen_state = local_strategy(state_tuple)
            when = Dict{String, String}()
            for (info_index, state_index) in zip(info_indices, state_tuple)
                when[String(diagram.Names[info_index])] = String(DecisionProgramming.get_values(diagram.States)[info_index][state_index])
            end
            action = String(DecisionProgramming.get_values(diagram.States)[decision_index][chosen_state])
            push!(rows, Dict("when" => when, "action" => action))
        end

        policy[decision_name] = rows
    end

    return policy
end

function render_information_sets(diagram::InfluenceDiagram)
    result = Dict{String, Any}()
    for (name, node) in diagram.D
        result[String(name)] = String.(node.I_j)
    end
    return result
end

function write_result(path::AbstractString, diagram::InfluenceDiagram, strategy::DecisionStrategy, expected_utility::Float64, status::String; source::String)
    result = Dict(
        "source" => source,
        "engine" => Dict(
            "name" => "DecisionProgramming.jl",
            "version" => "2.0.1",
            "commit" => "105a25ee898cc806db65d5b475e4f1a613265653",
            "solver" => "HiGHS",
        ),
        "information_sets" => render_information_sets(diagram),
        "policy" => render_policy(diagram, strategy),
        "expected_utility" => expected_utility,
        "termination_status" => status,
    )
    open(path, "w") do io
        JSON3.pretty(io, result)
    end
end
