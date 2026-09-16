using Pkg

Pkg.activate(@__DIR__)
Pkg.add(PackageSpec(url = "https://github.com/gamma-opt/DecisionProgramming.jl", rev = "105a25ee898cc806db65d5b475e4f1a613265653"))
Pkg.instantiate()
Pkg.precompile()
