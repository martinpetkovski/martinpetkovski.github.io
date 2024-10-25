vector&lt;int&gt; find_nodes_with_no_incoming_edges(AdjacencyListGraph alg)
{
	vector&lt;int&gt; nodes_with_no_incoming_edges;
	for (int i = 0; i &lt; alg.ajd_list_size(); i++)
	{
		if (alg.get_connections_to_node(i).size() == 0 && alg.get_connections_from_node(i).size() != 0)
			nodes_with_no_incoming_edges.push_back(i);
	}

	return nodes_with_no_incoming_edges;
}

vector&lt;int&gt; topological_sort(AdjacencyListGraph alg)
{
	vector&lt;int&gt; sorted_list;
	vector&lt;int&gt; nodes_with_no_incoming_edges = find_nodes_with_no_incoming_edges(alg);

	while (nodes_with_no_incoming_edges.size() &gt; 0)
	{
		int current_node = nodes_with_no_incoming_edges.back();
		nodes_with_no_incoming_edges.pop_back();
		sorted_list.push_back(current_node);

		for (int i = 0; i &lt; alg.ajd_list_size(); i++)
			alg.remove_connection(current_node, i);

		nodes_with_no_incoming_edges = find_nodes_with_no_incoming_edges(alg);
	}

	for (int i = 0; i &lt; alg.ajd_list_size(); i++)
	{
		if (find(sorted_list.begin(), sorted_list.end(), i) == sorted_list.end())
			sorted_list.push_back(i);
	}

	return sorted_list;
}